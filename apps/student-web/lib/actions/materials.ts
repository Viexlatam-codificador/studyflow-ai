"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIProviderNotConfiguredError } from "@studyflow/ai-core";
import { extractText, UnsupportedFileTypeError } from "@/lib/materials/extract-text";

/** Called after the browser has already uploaded the file directly to
 * Supabase Storage (bucket `course-materials`, path `${user_id}/...`) —
 * this just records the metadata row. */
export async function createMaterialRecord(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = (formData.get("title") as string)?.trim();
  const storagePath = formData.get("storage_path") as string;
  const fileType = formData.get("file_type") as string;
  const subjectId = (formData.get("subject_id") as string) || null;
  if (!title || !storagePath) throw new Error("Falta título o archivo.");

  const { data: material, error } = await supabase
    .from("course_materials")
    .insert({
      user_id: user.id,
      title,
      storage_path: storagePath,
      file_type: fileType,
      subject_id: subjectId,
      extracted_text_status: "PENDING",
    })
    .select("id")
    .single();

  if (error || !material) throw new Error(error?.message ?? "No se pudo guardar el material.");

  revalidatePath("/materials");
  redirect(`/materials/${material.id}`);
}

export interface MaterialUploadItem {
  title: string;
  storagePath: string;
  fileType: string;
  subjectId: string | null;
}

/** Same as createMaterialRecord but for many files uploaded together (the
 * common case — students rarely upload just one file at a time) — inserts
 * them all in one batch and doesn't redirect, since there's no single
 * detail page to send the user to. */
export async function createMaterialRecords(items: MaterialUploadItem[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (items.length === 0) return;

  const { error } = await supabase.from("course_materials").insert(
    items.map((item) => ({
      user_id: user.id,
      title: item.title,
      storage_path: item.storagePath,
      file_type: item.fileType,
      subject_id: item.subjectId,
      extracted_text_status: "PENDING",
    }))
  );

  if (error) throw new Error(error.message);

  revalidatePath("/materials");
}

export async function generateMaterialSummary(materialId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: material, error: materialError } = await supabase
    .from("course_materials")
    .select("id, storage_path, file_type, title")
    .eq("id", materialId)
    .single();
  if (materialError || !material) throw new Error("Material no encontrado.");

  await supabase.from("course_materials").update({ extracted_text_status: "PROCESSING" }).eq("id", materialId);

  try {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("course-materials")
      .download(material.storage_path);
    if (downloadError || !fileBlob) throw new Error(downloadError?.message ?? "No se pudo descargar el archivo.");

    const buffer = await fileBlob.arrayBuffer();
    const text = await extractText(buffer, material.file_type ?? "");

    if (!text.trim()) {
      throw new Error("No se pudo extraer texto de este archivo (¿es una imagen escaneada sin texto?).");
    }

    let summary: string;
    try {
      const provider = getAIProvider();
      const result = await provider.complete({
        feature: "SMART_PLANNER",
        userId: user.id,
        maxTokens: 500,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "Eres el asistente de StudyFlow AI. Resume el siguiente material de estudio en español, en formato " +
              "de lista con los puntos clave (máximo 8 puntos), pensado para que un estudiante repase rápido antes " +
              "de una prueba. No inventes información que no esté en el texto.",
          },
          { role: "user", content: text },
        ],
      });
      summary = result.content.trim();
    } catch (err) {
      if (err instanceof AIProviderNotConfiguredError) {
        throw new Error("No hay un proveedor de IA configurado (falta OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY).");
      }
      throw err;
    }

    await supabase.from("ai_content").insert({
      user_id: user.id,
      material_id: materialId,
      type: "summary",
      content: summary,
    });

    await supabase.from("course_materials").update({ extracted_text_status: "READY" }).eq("id", materialId);
  } catch (err) {
    await supabase.from("course_materials").update({ extracted_text_status: "FAILED" }).eq("id", materialId);
    throw err instanceof UnsupportedFileTypeError ? err : new Error(err instanceof Error ? err.message : "Error generando el resumen.");
  }

  revalidatePath(`/materials/${materialId}`);
}
