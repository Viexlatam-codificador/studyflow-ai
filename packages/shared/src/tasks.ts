export const TASK_SOURCES = [
  "MANUAL",
  "CLASS_TEXT",
  "CLASS_AUDIO",
  "WHITEBOARD_PHOTO",
  "DOCUMENT",
  "EMAIL",
  "BLACKBOARD",
  "CALENDAR",
  "PROFESSOR",
  "SYSTEM",
] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const TASK_STATUSES = [
  "NEW",
  "PENDING",
  "IN_PROGRESS",
  "REVIEW",
  "COMPLETED",
  "SUBMITTED",
  "OVERDUE",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: string;
  userId: string;
  institutionId: string | null;
  subjectId: string | null;
  title: string;
  description: string | null;
  professorId: string | null;
  dueAt: string | null;
  startsAt: string | null;
  estimatedMinutes: number | null;
  difficulty: number | null;
  priorityScore: number | null;
  gradeWeight: number | null;
  status: TaskStatus;
  progressPercentage: number;
  instructions: string | null;
  source: TaskSource;
  sourceUrl: string | null;
  externalId: string | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Minimum confidence (0..1) an AI extraction needs before StudyFlow will
 * even suggest auto-checking fields for the user — below this everything
 * still requires manual review either way. See docs/product/inbox.md */
export const INBOX_AUTOFILL_CONFIDENCE_THRESHOLD = 0.6;

/** AI-extracted data is NEVER saved without explicit user confirmation,
 * regardless of confidence — see master spec section 9. */
export const INBOX_REQUIRES_CONFIRMATION = true;
