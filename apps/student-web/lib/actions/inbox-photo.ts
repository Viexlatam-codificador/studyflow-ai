"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIProviderNotConfiguredError } from "@studyflow/ai-core";
import { matchSubjectInText } from "@studyflow/academic-core";
import type { InboxDraft } from "./inbox";

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string", description: "Transcribe lo relevante escrito en la pizarra." },
    due_at: { type: ["string", "null"], description: "ISO 8601 datetime, or null if not mentioned" },
    subject_guess: { type: ["string", "null"] },
    grade_weight: { type: ["number", "null"] },
    estimated_minutes: { type: ["number", "null"] },
    confidence: { type: "number", description: "0 to 1" },
  },
  required: ["title", "description", "confidence"],
};

/** Uploads happen client-side directly to Storage (bucket `course-materials`,
 * prefix `${userId}/whiteboard/...`) — this just downloads that file back,
 * sends it to a vision-capable AI provider, and produces a draft the user
 * must review and confirm (same contract as extractFromInboxText). */
export async function extractFromInboxPhoto(storagePath: string, mimeType: string): Promise<InboxDraft> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: enrolledSubjects } = await supabase
    .from("subject_members")
    .select("subjects(id, name)")
    .eq("user_id", user.id);
  const subjects = (enrolledSubjects ?? [])
    .flatMap((s) => (Array.isArray(s.subjects) ? s.subjects : s.subjects ? [s.subjects] : []))
    .filter((s): s is { id: string; name: string } => Boolean(s));

  const { data: fileBlob, error: downloadError } = await supabase.storage.from("course-materials").download(storagePath);
  if (downloadError || !fileBlob) throw new Error(downloadError?.message ?? "No se pudo leer la foto subida.");

  const base64 = Buffer.from(await fileBlob.arrayBuffer()).toString("base64");

  let extraction: Omit<InboxDraft, "inboxItemId" | "aiGenerated">;
  let aiGenerated: boolean;

  try {
    const provider = getAIProvider();
    const result = await provider.extractStructured<{
      title: string;
      description: string;
      due_at: string | null;
      subject_guess: string | null;
      grade_weight: number | null;
      estimated_minutes: number | null;
      confidence: number;
    }>({
      feature: "WHITEBOARD_EXTRACTION",
      userId: user.id,
      schemaName: "whiteboard_extraction",
      schema: EXTRACTION_SCHEMA,
      images: [{ base64, mimeType }],
      messages: [
        {
          role: "system",
          content:
            "Eres el asistente de StudyFlow AI. El usuario subió una foto de una pizarra o diapositiva de clase. " +
            "Lee lo escrito y extrae la tarea/evaluación académica que describe, en español. Responde SOLO el JSON pedido.",
        },
        { role: "user", content: "Extrae la tarea de esta foto." },
      ],
    });

    const matchedSubject = matchSubjectInText(result.data.subject_guess ?? result.data.description, subjects);

    extraction = {
      title: result.data.title,
      description: result.data.description,
      dueAt: result.data.due_at,
      subjectId: matchedSubject?.id ?? null,
      subjectGuess: result.data.subject_guess,
      gradeWeight: result.data.grade_weight,
      estimatedMinutes: result.data.estimated_minutes,
      confidence: result.confidence,
    };
    aiGenerated = true;
  } catch (err) {
    if (!(err instanceof AIProviderNotConfiguredError)) {
      console.warn("Whiteboard photo extraction failed:", err);
    }
    aiGenerated = false;
    extraction = {
      title: "Nueva tarea (revisa la foto)",
      description: "",
      dueAt: null,
      subjectId: null,
      subjectGuess: null,
      gradeWeight: null,
      estimatedMinutes: null,
      confidence: 0,
    };
  }

  const { data: inboxItem, error } = await supabase
    .from("inbox_items")
    .insert({
      user_id: user.id,
      type: "WHITEBOARD_PHOTO",
      raw_storage_path: storagePath,
      ai_extraction: extraction,
      confidence: extraction.confidence,
      status: "PENDING_REVIEW",
    })
    .select("id")
    .single();

  if (error || !inboxItem) throw new Error(error?.message ?? "No se pudo crear el borrador.");

  return { ...extraction, inboxItemId: inboxItem.id, aiGenerated };
}
