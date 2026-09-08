import { createClient } from "@/lib/supabase/server";
import { calculatePriorityScore } from "@studyflow/academic-core";
import type { Task } from "@studyflow/shared";

export interface TaskCollaborator {
  id: string;
  invitedEmail: string;
  userName: string | null;
  status: "PENDING" | "ACCEPTED";
}

export interface TaskDetail extends Task {
  subjectName: string | null;
  subjectColor: string | null;
  collaborativeDocUrl: string | null;
  isOwner: boolean;
  collaborators: TaskCollaborator[];
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from("tasks")
    .select("*, subjects(name, color)")
    .eq("id", taskId)
    .maybeSingle();

  if (!row) return null;

  const { data: collaboratorRows } = await supabase
    .from("task_collaborators")
    .select("id, invited_email, status, profiles(name)")
    .eq("task_id", taskId);

  const subject = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;

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
    subjectName: subject?.name ?? null,
    subjectColor: subject?.color ?? null,
    collaborativeDocUrl: row.collaborative_doc_url,
    isOwner: row.user_id === user.id,
    collaborators: (collaboratorRows ?? []).map((c) => {
      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      return {
        id: c.id,
        invitedEmail: c.invited_email,
        userName: profile?.name ?? null,
        status: c.status,
      };
    }),
  };
}
