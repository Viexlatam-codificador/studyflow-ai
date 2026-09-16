export const SESSION_METHODS = ["examples", "steps", "diagrams", "exercises", "questions", "mixed"] as const;
export type SessionMethod = (typeof SESSION_METHODS)[number];

/** Who decided this session should exist. The engine always has the final
 * say on *placement* (start/end time) — `GEMINI` only means the objective/
 * method/estimate for that slot came from an imported proposal (section 7),
 * never that Gemini scheduled it directly. */
export const PLAN_ITEM_ORIGINS = ["ENGINE", "GEMINI"] as const;
export type PlanItemOrigin = (typeof PLAN_ITEM_ORIGINS)[number];

export const PLAN_ITEM_STATUSES = ["PLANNED", "COMPLETED", "SKIPPED"] as const;
export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number];

export interface StudyPlanItem {
  id: string;
  studyPlanId: string;
  taskId: string | null;
  subjectId: string | null;
  startsAt: string; // ISO instant
  endsAt: string; // ISO instant
  objective: string;
  method: SessionMethod;
  expectedResult: string;
  priorityReason: string;
  origin: PlanItemOrigin;
  status: PlanItemStatus;
  /** True only for items the student explicitly pinned — regeneration must
   * never move or remove these (section 5, "conservar ... bloques fijados"). */
  isFixed: boolean;
}

export const STUDY_PLAN_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type StudyPlanStatus = (typeof STUDY_PLAN_STATUSES)[number];

export interface StudyPlan {
  id: string;
  userId: string;
  title: string;
  weekStart: string; // "YYYY-MM-DD", Monday of the planned week
  status: StudyPlanStatus;
  generatedAt: string;
  /** Minutes of estimated work that did NOT fit in available time — shown
   * to the student instead of silently dropped (section 5). */
  unassignedMinutes: number;
  items: StudyPlanItem[];
}

export const SESSION_OBJECTIVE_STATUSES = ["COMPLETED", "PARTIAL", "PENDING"] as const;
export type SessionObjectiveStatus = (typeof SESSION_OBJECTIVE_STATUSES)[number];

/** What the student reports right after a session (section 8). Kept
 * separate from `SubjectConfidence` on purpose — a comfortable session is
 * not proof of mastery. */
export interface StudySessionResult {
  sessionId: string;
  studyPlanItemId: string | null;
  actualMinutes: number;
  objectiveStatus: SessionObjectiveStatus;
  comprehensionRating: number | null; // 1..5, self-reported
  difficultyRating: number | null; // 1..5, self-reported
  methodUsed: SessionMethod | null;
  comment: string | null;
  checkResult: { correct: number; total: number } | null;
}
