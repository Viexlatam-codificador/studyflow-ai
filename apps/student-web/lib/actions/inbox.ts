"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIProviderNotConfiguredError } from "@studyflow/ai-core";
import { extractTaskFromText, matchSubjectInText } from "@studyflow/academic-core";

export interface InboxDraft {
  inboxItemId: string;
  title: string;
  description: string;
  dueAt: string | null;
  subjectId: string | null;
  subjectGuess: string | null;
  gradeWeight: number | null;
  estimatedMinutes: number | null;
  confidence: number;
  /** true when this draft came from the AI provider rather than the
   * rule-based extractor — used only to label the draft, never to gate
   * whether the Inbox works (see docs/product/accessible-by-default.md). */
  aiGenerated: boolean;
}

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    due_at: { type: ["string", "null"], description: "ISO 8601 datetime, or null if not mentioned" },
    subject_guess: { type: ["string", "null"] },
    grade_weight: { type: ["number", "null"] },
    estimated_minutes: { type: ["number", "null"] },
    confidence: { type: "number", description: "0 to 1" },
  },
  required: ["title", "description", "confidence"],
};

type ExtractionResult = Omit<InboxDraft, "inboxItemId" | "aiGenerated">;

/** Never saves a task directly — only ever produces a draft the user must
 * review and confirm (master spec section 9: "NUNCA guardar automáticamente
 * información extraída ... sin confirmación").
 *
 * StudyFlow's Inbox is fully useful without any AI provider configured —
 * the rule-based extractor (packages/academic-core) is a real feature, not
 * an apologetic fallback, so students who can't afford an AI API key still
 * get real date/subject/grade-weight detection. AI, when available, is a
 * strictly-better upgrade on top of that, never a requirement. */
export async function extractFromInboxText(rawText: string): Promise<InboxDraft> {
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

  let extraction: ExtractionResult;
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
      feature: "INBOX_EXTRACTION",
      userId: user.id,
      schemaName: "inbox_extraction",
      schema: EXTRACTION_SCHEMA,
      messages: [
        {
          role: "system",
          content:
            "Extraes tareas académicas desde texto informal en español (lo que un estudiante escribe rápido, " +
            "o repite de lo que dijo un profesor). Responde SOLO el JSON pedido. Si no hay fecha explícita, due_at es null.",
        },
        { role: "user", content: rawText },
      ],
    });

    const matchedSubject = matchSubjectInText(result.data.subject_guess ?? rawText, subjects);

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
      // console.warn, not console.error — handled fallback path, and
      // Next.js dev renders console.error as a full-screen overlay.
      console.warn("Inbox AI extraction unavailable, using rule-based extraction:", err);
    }
    aiGenerated = false;
    extraction = extractTaskFromText(rawText, { subjects });
  }

  const { data: inboxItem, error } = await supabase
    .from("inbox_items")
    .insert({
      user_id: user.id,
      type: "TEXT",
      raw_input: rawText,
      ai_extraction: extraction,
      confidence: extraction.confidence,
      status: "PENDING_REVIEW",
    })
    .select("id")
    .single();

  if (error || !inboxItem) throw new Error(error?.message ?? "No se pudo crear el borrador.");

  return { ...extraction, inboxItemId: inboxItem.id, aiGenerated };
}

export async function confirmInboxItem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const inboxItemId = formData.get("inbox_item_id") as string;
  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("El título es obligatorio.");

  const dueAtRaw = formData.get("due_at") as string;
  const gradeWeightRaw = formData.get("grade_weight") as string;
  const estimatedMinutesRaw = formData.get("estimated_minutes") as string;
  const subjectId = (formData.get("subject_id") as string) || null;

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title,
      description: (formData.get("description") as string) || null,
      subject_id: subjectId,
      due_at: dueAtRaw ? new Date(dueAtRaw).toISOString() : null,
      grade_weight: gradeWeightRaw ? Number(gradeWeightRaw) : null,
      estimated_minutes: estimatedMinutesRaw ? Number(estimatedMinutesRaw) : null,
      source: "CLASS_TEXT",
      status: "NEW",
    })
    .select("id")
    .single();

  if (taskError || !task) throw new Error(taskError?.message ?? "No se pudo crear la tarea.");

  await supabase
    .from("inbox_items")
    .update({ status: "CONFIRMED", resulting_task_id: task.id, reviewed_at: new Date().toISOString() })
    .eq("id", inboxItemId);

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  redirect("/tasks");
}

export async function discardInboxItem(inboxItemId: string) {
  const supabase = await createClient();
  await supabase
    .from("inbox_items")
    .update({ status: "DISCARDED", reviewed_at: new Date().toISOString() })
    .eq("id", inboxItemId);
  revalidatePath("/inbox");
}
