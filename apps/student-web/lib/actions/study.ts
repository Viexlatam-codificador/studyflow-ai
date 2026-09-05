"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function startStudySession(taskId: string | null, plannedMinutes: number): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("study_sessions")
    .insert({ user_id: user.id, task_id: taskId, planned_minutes: plannedMinutes })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo iniciar la sesión.");

  if (taskId) {
    await supabase.from("tasks").update({ status: "IN_PROGRESS" }).eq("id", taskId).eq("status", "NEW");
  }

  return data.id;
}

export async function endStudySession(formData: FormData) {
  const supabase = await createClient();
  const sessionId = formData.get("session_id") as string;
  const actualMinutes = Number(formData.get("actual_minutes") ?? 0);
  const outcomeNotes = (formData.get("outcome_notes") as string) || null;
  const taskId = (formData.get("task_id") as string) || null;
  const progressGained = Number(formData.get("progress_gained") ?? 0);

  const { error } = await supabase
    .from("study_sessions")
    .update({ ended_at: new Date().toISOString(), actual_minutes: actualMinutes, outcome_notes: outcomeNotes })
    .eq("id", sessionId);

  if (error) throw new Error(error.message);

  if (taskId && progressGained > 0) {
    const { data: task } = await supabase.from("tasks").select("progress_percentage").eq("id", taskId).single();
    if (task) {
      const newProgress = Math.min(100, task.progress_percentage + progressGained);
      await supabase
        .from("tasks")
        .update({ progress_percentage: newProgress, status: newProgress >= 100 ? "COMPLETED" : "IN_PROGRESS" })
        .eq("id", taskId);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/study");
  redirect("/study?finished=1");
}
