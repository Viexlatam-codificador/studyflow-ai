import { createClient } from "@/lib/supabase/server";
import { mondayOf, utcToZonedParts } from "@studyflow/academic-core";
import type { PlanItemOrigin, PlanItemStatus, SessionMethod } from "@studyflow/shared";

export interface StudyPlanItemRow {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  subjectId: string | null;
  subjectName: string | null;
  startsAt: string;
  endsAt: string;
  objective: string;
  method: SessionMethod;
  expectedResult: string;
  priorityReason: string;
  origin: PlanItemOrigin;
  status: PlanItemStatus;
  isFixed: boolean;
}

export interface StudyPlanRow {
  id: string;
  weekStart: string;
  generatedAt: string;
  unassignedMinutes: number;
  items: StudyPlanItemRow[];
}

/** The plan for the week containing `now` (defaults to the real current
 * instant) — not necessarily the same as "the plan generated most
 * recently", since a student could look at last week's history too. */
export async function getPlanForWeek(now: Date = new Date(), timezone = "America/Santiago"): Promise<StudyPlanRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const weekStart = mondayOf(utcToZonedParts(now, timezone).dateStr);

  const { data: plan } = await supabase
    .from("study_plans")
    .select("id, week_start, generated_at, unassigned_minutes")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!plan) return null;

  const { data: items } = await supabase
    .from("study_plan_items")
    .select("id, task_id, subject_id, starts_at, ends_at, objective, method, expected_result, priority_reason, origin, status, is_fixed, tasks(title), subjects(name)")
    .eq("study_plan_id", plan.id)
    .order("starts_at", { ascending: true });

  return {
    id: plan.id,
    weekStart: plan.week_start,
    generatedAt: plan.generated_at,
    unassignedMinutes: plan.unassigned_minutes,
    items: (items ?? []).map((i) => {
      const task = Array.isArray(i.tasks) ? i.tasks[0] : i.tasks;
      const subject = Array.isArray(i.subjects) ? i.subjects[0] : i.subjects;
      return {
        id: i.id,
        taskId: i.task_id,
        taskTitle: task?.title ?? null,
        subjectId: i.subject_id,
        subjectName: subject?.name ?? null,
        startsAt: i.starts_at,
        endsAt: i.ends_at,
        objective: i.objective ?? "",
        method: (i.method ?? "mixed") as SessionMethod,
        expectedResult: i.expected_result ?? "",
        priorityReason: i.priority_reason ?? "",
        origin: i.origin as PlanItemOrigin,
        status: i.status as PlanItemStatus,
        isFixed: i.is_fixed,
      };
    }),
  };
}

/** Items already COMPLETED or explicitly pinned, across the whole plan
 * history (not just this week) — passed to the engine as "occupied" time
 * so regeneration never moves or deletes them (section 5). */
export async function listFixedItemsAhead(now: Date): Promise<{ id: string; taskId: string | null; startsAt: string; endsAt: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("study_plan_items")
    .select("id, task_id, starts_at, ends_at, status, is_fixed, study_plans!inner(user_id)")
    .eq("study_plans.user_id", user.id)
    .gte("ends_at", now.toISOString())
    .or("status.eq.COMPLETED,is_fixed.eq.true");

  return (data ?? []).map((d) => ({ id: d.id, taskId: d.task_id, startsAt: d.starts_at, endsAt: d.ends_at }));
}
