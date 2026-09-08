import { createClient } from "@/lib/supabase/server";

export interface MaterialRow {
  id: string;
  title: string;
  fileType: string | null;
  extractedTextStatus: string;
  createdAt: string;
  subjectName: string | null;
  visibility: "PRIVATE" | "SUBJECT";
}

export async function listMaterialsForCurrentUser(): Promise<MaterialRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("course_materials")
    .select("id, title, file_type, extracted_text_status, created_at, visibility, subjects(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((m) => {
    const subject = Array.isArray(m.subjects) ? m.subjects[0] : m.subjects;
    return {
      id: m.id,
      title: m.title,
      fileType: m.file_type,
      extractedTextStatus: m.extracted_text_status,
      createdAt: m.created_at,
      subjectName: subject?.name ?? null,
      visibility: m.visibility,
    };
  });
}

export interface SharedMaterialRow extends MaterialRow {
  uploaderName: string | null;
}

/** Materials classmates uploaded and explicitly shared with the subject
 * (visibility = SUBJECT) — RLS only returns rows for subjects the current
 * user is actually enrolled in, so this never leaks across subjects. */
export async function listSharedMaterialsForCurrentUser(): Promise<SharedMaterialRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("course_materials")
    .select("id, title, file_type, extracted_text_status, created_at, visibility, subjects(name), profiles(name)")
    .eq("visibility", "SUBJECT")
    .neq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((m) => {
    const subject = Array.isArray(m.subjects) ? m.subjects[0] : m.subjects;
    const uploader = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.id,
      title: m.title,
      fileType: m.file_type,
      extractedTextStatus: m.extracted_text_status,
      createdAt: m.created_at,
      subjectName: subject?.name ?? null,
      visibility: m.visibility,
      uploaderName: uploader?.name ?? null,
    };
  });
}

export interface MaterialDetail extends MaterialRow {
  storagePath: string;
  summaries: { id: string; content: string; createdAt: string }[];
}

export async function getMaterialDetail(materialId: string): Promise<MaterialDetail | null> {
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("course_materials")
    .select("id, title, file_type, extracted_text_status, created_at, storage_path, visibility, subjects(name)")
    .eq("id", materialId)
    .single();

  if (!material) return null;

  const { data: summaries } = await supabase
    .from("ai_content")
    .select("id, content, created_at")
    .eq("material_id", materialId)
    .eq("type", "summary")
    .order("created_at", { ascending: false });

  const subject = Array.isArray(material.subjects) ? material.subjects[0] : material.subjects;

  return {
    id: material.id,
    title: material.title,
    fileType: material.file_type,
    extractedTextStatus: material.extracted_text_status,
    createdAt: material.created_at,
    storagePath: material.storage_path,
    subjectName: subject?.name ?? null,
    visibility: material.visibility,
    summaries: (summaries ?? []).map((s) => ({ id: s.id, content: s.content, createdAt: s.created_at })),
  };
}
