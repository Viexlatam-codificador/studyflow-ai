"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateWeeklyPlan, mondayOf, utcToZonedParts, type GeminiTaskContent, type PlannableTask } from "@studyflow/academic-core";
import { listTasksForCurrentUser } from "@/lib/data/tasks";
import { getAvailability } from "@/lib/data/availability";
import { getStudyProfile, listSubjectConfidence } from "@/lib/data/study-profile";
import { listFixedItemsAhead } from "@/lib/data/study-plan";
import { computeAndPersistObservations } from "@/lib/actions/observations";

export interface RegeneratePlanResult {
  planId: string | null;
  unassignedMinutes: number;
  error?: string;
}

/**
 * Recomputes the current week's plan with the free engine and upserts it
 * atomically via the `regenerate_study_plan` Postgres function — see
 * supabase/migrations/0024_regenerate_study_plan_function.sql for why this
 * needs to be a single DB transaction rather than separate supabase-js
 * calls (idempotent regeneration, section 10).
 */
export async function regeneratePlan(geminiContent?: GeminiTaskContent): Promise<RegeneratePlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const [tasks, availability, profile, subjectConfidenceRows, fixedItems] = await Promise.all([
    listTasksForCurrentUser(),
    getAvailability(),
    getStudyProfile(),
    listSubjectConfidence(),
    listFixedItemsAhead(now),
  ]);

  const plannable: PlannableTask[] = tasks
    .filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED")
    .map((t) => ({
      id: t.id,
      title: t.title,
      subjectId: t.subjectId,
      subjectName: t.subjectName,
      dueAt: t.dueAt,
      estimatedMinutes: t.estimatedMinutes,
      gradeWeight: t.gradeWeight,
      difficulty: t.difficulty,
      progressPercentage: t.progressPercentage,
      status: t.status,
    }));

  const subjectConfidence: Record<string, number> = {};
  for (const s of subjectConfidenceRows) {
    if (s.declaredConfidence !== null) subjectConfidence[s.subjectId] = s.declaredConfidence;
  }

  const result = generateWeeklyPlan({
    now,
    timezone: availability.settings.timezone,
    tasks: plannable,
    availabilityBlocks: availability.blocks.map((b) => ({ id: b.id, userId: user.id, kind: b.kind, title: b.title, dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime })),
    availabilityExceptions: availability.exceptions.map((e) => ({ id: e.id, userId: user.id, exceptionDate: e.exceptionDate, kind: e.kind, startTime: e.startTime, endTime: e.endTime, note: e.note })),
    settings: { userId: user.id, ...availability.settings },
    profile: { sessionDurationMinutes: profile.sessionDurationMinutes, explanationMethods: profile.explanationMethods },
    subjectConfidence,
    fixedItems: fixedItems.map((f) => ({ id: f.id, taskId: f.taskId, startsAt: f.startsAt, endsAt: f.endsAt })),
    geminiContent,
  });

  const weekStart = mondayOf(utcToZonedParts(now, availability.settings.timezone).dateStr);

  const { data: planId, error } = await supabase.rpc("regenerate_study_plan", {
    p_week_start: weekStart,
    p_title: "Plan de la semana",
    p_unassigned_minutes: result.unassignedMinutes,
    p_items: result.items.map((item) => ({
      taskId: item.taskId,
      subjectId: item.subjectId,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      objective: item.objective,
      method: item.method,
      expectedResult: item.expectedResult,
      priorityReason: item.priorityReason,
      origin: item.origin,
    })),
  });

  if (error) return { planId: null, unassignedMinutes: result.unassignedMinutes, error: error.message };

  revalidatePath("/study/plan");
  revalidatePath("/dashboard");
  return { planId: planId as string, unassignedMinutes: result.unassignedMinutes };
}

export interface CompleteItemInput {
  itemId: string;
  actualMinutes: number;
  objectiveStatus: "COMPLETED" | "PARTIAL" | "PENDING";
  comprehensionRating: number | null;
  difficultyRating: number | null;
  methodUsed: string | null;
  comment: string | null;
  checkCorrect: number | null;
  checkTotal: number | null;
}

/** Records the result of a plan item's session and marks the item
 * COMPLETED — idempotent in practice because `study_sessions` gets a new
 * row per call but `study_plan_items.status` moving to COMPLETED makes a
 * repeated call a no-op for planning purposes (the item is then excluded
 * from any future regenerate's delete/replace). */
export async function completeStudyPlanItem(input: CompleteItemInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: item, error: itemError } = await supabase
    .from("study_plan_items")
    .select("id, task_id, subject_id, starts_at, ends_at, study_plans!inner(user_id)")
    .eq("id", input.itemId)
    .eq("study_plans.user_id", user.id)
    .maybeSingle();

  if (itemError || !item) return { error: "No se encontró la sesión o no te pertenece." };

  const plannedMinutes = Math.round((new Date(item.ends_at).getTime() - new Date(item.starts_at).getTime()) / 60000);

  const { error: sessionError } = await supabase.from("study_sessions").insert({
    user_id: user.id,
    task_id: item.task_id,
    subject_id: item.subject_id,
    study_plan_item_id: item.id,
    planned_minutes: plannedMinutes,
    actual_minutes: input.actualMinutes,
    started_at: item.starts_at,
    ended_at: new Date().toISOString(),
    objective_status: input.objectiveStatus,
    comprehension_rating: input.comprehensionRating,
    difficulty_rating: input.difficultyRating,
    method_used: input.methodUsed,
    outcome_notes: input.comment,
    check_result: input.checkCorrect !== null && input.checkTotal !== null ? { correct: input.checkCorrect, total: input.checkTotal } : null,
  });
  if (sessionError) return { error: sessionError.message };

  const { error: updateError } = await supabase
    .from("study_plan_items")
    .update({ status: "COMPLETED", is_completed: true })
    .eq("id", item.id);
  if (updateError) return { error: updateError.message };

  // "Al terminar una sesión ... con evidencia suficiente, propone ajustes"
  // (section 8) — checked right after the session that might tip the
  // evidence count over the minimum, not on every page view.
  await computeAndPersistObservations();

  revalidatePath("/study/plan");
  revalidatePath("/dashboard");
  return {};
}

/** Pins/unpins an item so a future regenerate never touches it (section 5,
 * "conservar ... bloques fijados"). */
export async function setStudyPlanItemFixed(itemId: string, isFixed: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: item } = await supabase
    .from("study_plan_items")
    .select("id, study_plans!inner(user_id)")
    .eq("id", itemId)
    .eq("study_plans.user_id", user.id)
    .maybeSingle();
  if (!item) return { error: "No se encontró la sesión o no te pertenece." };

  const { error } = await supabase.from("study_plan_items").update({ is_fixed: isFixed }).eq("id", itemId);
  if (error) return { error: error.message };

  revalidatePath("/study/plan");
  return {};
}
