import { createClient } from "@/lib/supabase/server";
import { calculatePriorityScore } from "@studyflow/academic-core";
import type { Task } from "@studyflow/shared";

export interface TaskWithSubject extends Task {
  subjectName: string | null;
  subjectColor: string | null;
  sortOrder: number | null;
}

export async function listTasksForCurrentUser(): Promise<TaskWithSubject[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("*, subjects(name, color)")
    .eq("user_id", user.id)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error || !data) return [];

  return data.map((row) => {
    const task: Task = {
      id: row.id,
      userId: row.user_id,
      institutionId: row.institution_id,
      subjectId: row.subject_id,
      title: row.title,
      description: row.description,
      professorId: row.professor_id,
      dueAt: row.due_at,
      startsAt: row.starts_at,
      estimatedMinutes: row.estimated_minutes,
      difficulty: row.difficulty,
      priorityScore: row.priority_score,
      gradeWeight: row.grade_weight,
      status: row.status,
      progressPercentage: row.progress_percentage,
      instructions: row.instructions,
      source: row.source,
      sourceUrl: row.source_url,
      externalId: row.external_id,
      confidence: row.confidence,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return {
      ...task,
      priorityScore: task.priorityScore ?? calculatePriorityScore(task),
      subjectName: row.subjects?.name ?? null,
      subjectColor: row.subjects?.color ?? null,
      sortOrder: row.sort_order,
    };
  });
}

// Sorting helpers live in lib/task-sort.ts (no server-only imports) so
// client components can use them without pulling in next/headers.
export { rankByPriority, rankByManualOrder } from "@/lib/task-sort";
