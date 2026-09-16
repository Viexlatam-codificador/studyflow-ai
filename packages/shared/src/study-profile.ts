export const EXPLANATION_METHODS = [
  "examples",
  "steps",
  "diagrams",
  "exercises",
  "questions",
  "mixed",
] as const;
export type ExplanationMethod = (typeof EXPLANATION_METHODS)[number];

export const EXPLANATION_METHOD_LABELS: Record<ExplanationMethod, string> = {
  examples: "Ejemplos resueltos",
  steps: "Pasos numerados",
  diagrams: "Esquemas / diagramas",
  exercises: "Ejercicios para practicar",
  questions: "Preguntas de repaso",
  mixed: "Combinación de todo lo anterior",
};

export const SCHEDULE_PREFERENCES = ["MORNING", "AFTERNOON", "EVENING", "NIGHT", "FLEXIBLE"] as const;
export type SchedulePreference = (typeof SCHEDULE_PREFERENCES)[number];

export const SCHEDULE_PREFERENCE_LABELS: Record<SchedulePreference, string> = {
  MORNING: "Mañana",
  AFTERNOON: "Tarde",
  EVENING: "Noche",
  NIGHT: "Madrugada",
  FLEXIBLE: "Sin preferencia",
};

/** One row per user — the editable "quién es el alumno" profile (section 3).
 * Every field here is a *declared preference*, never an inferred diagnosis —
 * see `ConfidenceSource` for why confidence-per-subject is tracked
 * separately instead of folded into this table. */
export interface StudyProfile {
  userId: string;
  academicGoal: string | null;
  explanationMethods: ExplanationMethod[];
  sessionDurationMinutes: number | null;
  schedulePreference: SchedulePreference | null;
  minutesPerWeek: number | null;
  limitationsNote: string | null;
  freeNotes: string | null;
  onboardingSkipped: boolean;
  updatedAt: string;
}

/** Where a subject's confidence value came from. Only `DECLARED` is
 * writable from the profile form today — `REPORTED` (post-session
 * comprehension ratings) and `EXERCISE_RESULT` (check-result scores) are
 * derived at read time from `study_sessions`, never written here, so the
 * UI can show "evidencia todavía insuficiente" instead of pretending a
 * single self-rating is the same thing as a measured result. */
export const CONFIDENCE_SOURCES = ["DECLARED", "REPORTED", "EXERCISE_RESULT"] as const;
export type ConfidenceSource = (typeof CONFIDENCE_SOURCES)[number];

export interface SubjectConfidence {
  userId: string;
  subjectId: string;
  confidence: number; // 1..5
  source: ConfidenceSource;
  updatedAt: string;
}
