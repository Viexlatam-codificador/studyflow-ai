"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invites a classmate to a task by email. If they already have a
 * StudyFlow account, they get access immediately; otherwise the invite
 * links automatically the moment they sign up with that email (see
 * link_pending_task_invites trigger in 0016_task_collaboration.sql). */
export async function inviteCollaborator(taskId: string, email: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(cleanEmail)) throw new Error("Ingresa un correo válido.");
  if (cleanEmail === user.email?.toLowerCase()) throw new Error("Ya eres parte de esta tarea.");

  const { data: task } = await supabase.from("tasks").select("user_id").eq("id", taskId).single();
  if (!task || task.user_id !== user.id) throw new Error("No puedes invitar a esta tarea.");

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", cleanEmail)
    .maybeSingle();

  const { error } = await supabase.from("task_collaborators").insert({
    task_id: taskId,
    invited_email: cleanEmail,
    invited_by: user.id,
    user_id: existingProfile?.id ?? null,
    status: existingProfile ? "ACCEPTED" : "PENDING",
  });

  if (error) {
    if (error.code === "23505") throw new Error("Ya invitaste a este correo.");
    throw new Error(error.message);
  }

  revalidatePath(`/tasks/${taskId}`);
}

export async function removeCollaborator(collaboratorId: string, taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("task_collaborators").delete().eq("id", collaboratorId);
  if (error) throw new Error(error.message);

  revalidatePath(`/tasks/${taskId}`);
}

export async function updateCollaborativeDocUrl(taskId: string, url: string) {
  const supabase = await createClient();
  const trimmed = url.trim();

  if (trimmed && !/^https:\/\//i.test(trimmed)) {
    throw new Error("El enlace debe empezar con https://");
  }

  const { error } = await supabase
    .from("tasks")
    .update({ collaborative_doc_url: trimmed || null })
    .eq("id", taskId);

  if (error) throw new Error(error.message);

  revalidatePath(`/tasks/${taskId}`);
}
