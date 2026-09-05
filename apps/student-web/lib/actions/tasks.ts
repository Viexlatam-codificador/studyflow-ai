"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createTask(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("El título es obligatorio.");

  const dueAtRaw = formData.get("due_at") as string;
  const subjectId = (formData.get("subject_id") as string) || null;
  const gradeWeightRaw = formData.get("grade_weight") as string;
  const estimatedMinutesRaw = formData.get("estimated_minutes") as string;

  const { error } = await supabase.from("tasks").insert({
    user_id: user.id,
    title,
    description: (formData.get("description") as string) || null,
    subject_id: subjectId,
    due_at: dueAtRaw ? new Date(dueAtRaw).toISOString() : null,
    grade_weight: gradeWeightRaw ? Number(gradeWeightRaw) : null,
    estimated_minutes: estimatedMinutesRaw ? Number(estimatedMinutesRaw) : null,
    source: "MANUAL",
    status: "NEW",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
}

export async function updateTaskStatus(taskId: string, status: string) {
  const supabase = await createClient();
  const progress = status === "COMPLETED" ? 100 : undefined;

  const { error } = await supabase
    .from("tasks")
    .update({ status, ...(progress !== undefined ? { progress_percentage: progress } : {}) })
    .eq("id", taskId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

/** Persists the student's own drag-and-drop order ("Arrastra para ordenar"
 * mode in /tasks) — orderedIds is the full list, top to bottom. */
export async function reorderTasks(orderedIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("tasks").update({ sort_order: index }).eq("id", id).eq("user_id", user.id)
    )
  );

  revalidatePath("/tasks");
}
