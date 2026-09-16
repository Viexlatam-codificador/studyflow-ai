import type { SessionMethod } from "./study-plan";

/**
 * Versioned contract for the "Personalizar con mi Gemini" flow (section 7).
 * StudyFlow never talks to Gemini programmatically — the student copies a
 * context, pastes it into https://gemini.google.com/app themselves, and
 * pastes Gemini's answer back here. This is the *only* shape StudyFlow will
 * accept back. Bump `GEMINI_PROPOSAL_SCHEMA_VERSION` on any breaking change
 * and keep old versions readable for a while so a pasted-back answer from
 * an older exported context doesn't just fail with no explanation.
 */
export const GEMINI_PROPOSAL_SCHEMA_VERSION = 1;

/** Hard ceiling on the pasted-back text size, enforced before JSON.parse —
 * see zod validation in apps/student-web (this constant is the contract,
 * the actual runtime check lives next to `JSON.parse`). */
export const GEMINI_PROPOSAL_MAX_CHARS = 20_000;
export const GEMINI_PROPOSAL_MAX_SUGGESTIONS = 30;
export const GEMINI_PROPOSAL_MAX_QUESTIONS = 10;

export interface GeminiTaskSuggestion {
  /** Must match a `tasks.id` the *authenticated* user actually owns —
   * verified server-side against the DB, never trusted from the payload. */
  taskId: string;
  objective: string;
  method: SessionMethod;
  estimatedMinutes: number;
}

export const PREFERENCE_CHANGE_FIELDS = ["sessionDurationMinutes", "schedulePreference", "explanationMethods"] as const;
export type PreferenceChangeField = (typeof PREFERENCE_CHANGE_FIELDS)[number];

export interface GeminiPreferenceChange {
  field: PreferenceChangeField;
  value: string | number | string[];
  reason: string;
}

/** The full shape StudyFlow expects when the student pastes Gemini's reply
 * back in. Everything here is a *suggestion* — nothing is written to the
 * database until the student reviews a diff and explicitly confirms
 * (section 7, "guarda únicamente después de confirmar"). */
export interface GeminiProposal {
  schemaVersion: number;
  summary: string;
  suggestions: GeminiTaskSuggestion[];
  /** Questions Gemini needs answered before it can propose more — shown to
   * the student as-is, never auto-answered. */
  openQuestions: string[];
  preferenceChanges: GeminiPreferenceChange[];
}

/** What StudyFlow sends the student to paste into Gemini. Deliberately
 * excludes anything not needed for the task at hand — no email, no name,
 * no full task descriptions unless the student opts in (section 7). */
export interface GeminiContextExport {
  schemaVersion: number;
  generatedAt: string;
  /** Hash of the underlying tasks/constraints snapshot — an imported
   * proposal is rejected as stale if this no longer matches (section 7). */
  contextHash: string;
  studentGoal: string | null;
  preferences: {
    explanationMethods: string[];
    sessionDurationMinutes: number | null;
    minutesAvailableThisWeek: number;
  };
  tasks: {
    taskId: string;
    title: string;
    subjectName: string | null;
    dueAt: string | null;
    estimatedMinutes: number | null;
    gradeWeight: number | null;
    confidence: number | null; // subject confidence 1-5, if known
  }[];
  instructions: string;
}
