import type { Task } from "@studyflow/shared";

/**
 * Weights for the priority score (section 14 of the master spec).
 * They are documented here instead of being magic numbers scattered in code,
 * and must sum to 1 — `assertWeightsSum` below checks that at import time.
 */
export const PRIORITY_WEIGHTS = {
  /** How close the due date is. The single strongest signal — a task due
   * tomorrow should almost always outrank a bigger task due next month. */
  urgency: 0.35,
  /** Grade weight (% of the subject's final grade) — a 30%-of-grade exam
   * matters more than a 5%-of-grade reading. */
  gradeWeight: 0.25,
  /** Self-reported/estimated difficulty (1-5) — harder tasks need to start
   * earlier to leave room for getting stuck. */
  difficulty: 0.15,
  /** 100 - current progress — untouched tasks need more attention than
   * ones that are already mostly done. */
  progressGap: 0.15,
  /** Estimated time investment — larger tasks get a small nudge so they
   * don't get perpetually deferred in favor of quick wins. */
  workload: 0.1,
} as const;

function assertWeightsSum() {
  const total = Object.values(PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(`PRIORITY_WEIGHTS must sum to 1, got ${total}`);
  }
}
assertWeightsSum();

const DEFAULT_GRADE_WEIGHT = 20; // assume low-stakes when not specified
const DEFAULT_DIFFICULTY = 3; // out of 5
const WORKLOAD_CAP_MINUTES = 480; // 8h — anything at/above this maxes the workload signal
const URGENCY_HORIZON_DAYS = 14; // due dates 14+ days out contribute ~0 urgency

export interface PriorityInput {
  dueAt: string | null;
  estimatedMinutes: number | null;
  gradeWeight: number | null;
  difficulty: number | null;
  progressPercentage: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function urgencyScore(dueAt: string | null, now: Date): number {
  if (!dueAt) return 20; // no deadline set — mild baseline urgency
  const due = new Date(dueAt);
  const msRemaining = due.getTime() - now.getTime();
  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
  if (daysRemaining <= 0) return 100; // overdue or due today
  const decayed = 100 * (1 - daysRemaining / URGENCY_HORIZON_DAYS);
  return clamp(decayed, 0, 100);
}

function gradeWeightScore(gradeWeight: number | null): number {
  return clamp(gradeWeight ?? DEFAULT_GRADE_WEIGHT, 0, 100);
}

function difficultyScore(difficulty: number | null): number {
  const d = difficulty ?? DEFAULT_DIFFICULTY;
  return clamp((d / 5) * 100, 0, 100);
}

function progressGapScore(progressPercentage: number): number {
  return clamp(100 - progressPercentage, 0, 100);
}

function workloadScore(estimatedMinutes: number | null): number {
  if (!estimatedMinutes) return 30;
  return clamp((estimatedMinutes / WORKLOAD_CAP_MINUTES) * 100, 0, 100);
}

/** Computes a 0-100 priority score. Higher = do this sooner. */
export function calculatePriorityScore(input: PriorityInput, now: Date = new Date()): number {
  const score =
    PRIORITY_WEIGHTS.urgency * urgencyScore(input.dueAt, now) +
    PRIORITY_WEIGHTS.gradeWeight * gradeWeightScore(input.gradeWeight) +
    PRIORITY_WEIGHTS.difficulty * difficultyScore(input.difficulty) +
    PRIORITY_WEIGHTS.progressGap * progressGapScore(input.progressPercentage) +
    PRIORITY_WEIGHTS.workload * workloadScore(input.estimatedMinutes);
  return Math.round(clamp(score, 0, 100) * 100) / 100;
}

export interface TimeSlotRecommendation {
  task: Task;
  reason: string;
}

/**
 * "Tengo X minutos" (section 15) — picks the single best task to work on
 * given how much time the student actually has right now.
 */
export function recommendForAvailableTime(
  tasks: Task[],
  availableMinutes: number,
  now: Date = new Date()
): TimeSlotRecommendation | null {
  const actionable = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");
  if (actionable.length === 0) return null;

  const ranked = [...actionable].sort(
    (a, b) =>
      calculatePriorityScore(toPriorityInput(b), now) - calculatePriorityScore(toPriorityInput(a), now)
  );

  const fitsExactly = ranked.find(
    (t) => t.estimatedMinutes !== null && t.estimatedMinutes <= availableMinutes
  );
  const chosen = fitsExactly ?? ranked[0];

  return { task: chosen, reason: buildReason(chosen, availableMinutes, fitsExactly !== undefined, now) };
}

function toPriorityInput(task: Task): PriorityInput {
  return {
    dueAt: task.dueAt,
    estimatedMinutes: task.estimatedMinutes,
    gradeWeight: task.gradeWeight,
    difficulty: task.difficulty,
    progressPercentage: task.progressPercentage,
  };
}

function buildReason(task: Task, availableMinutes: number, fits: boolean, now: Date): string {
  const parts: string[] = [];
  if (task.dueAt) {
    const days = Math.ceil((new Date(task.dueAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) parts.push("vence hoy");
    else if (days === 1) parts.push("vence mañana");
    else parts.push(`vence en ${days} días`);
  }
  if (task.gradeWeight) parts.push(`vale ${task.gradeWeight}%`);
  if (task.progressPercentage === 0) parts.push("llevas 0% de avance");
  else parts.push(`llevas ${task.progressPercentage}% de avance`);
  if (!fits && task.estimatedMinutes) {
    parts.push(`necesitas ~${Math.ceil(task.estimatedMinutes / 60)}h en total, puedes avanzar ${availableMinutes} min ahora`);
  }
  return parts.join(" · ");
}
