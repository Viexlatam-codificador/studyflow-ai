import { createClient } from "@/lib/supabase/server";
import type { ExplanationMethod, SchedulePreference } from "@studyflow/shared";

export interface StudyProfileRow {
  academicGoal: string | null;
  explanationMethods: ExplanationMethod[];
  sessionDurationMinutes: number | null;
  schedulePreference: SchedulePreference | null;
  minutesPerWeek: number | null;
  limitationsNote: string | null;
  freeNotes: string | null;
  onboardingSkipped: boolean;
}

const EMPTY_PROFILE: StudyProfileRow = {
  academicGoal: null,
  explanationMethods: [],
  sessionDurationMinutes: null,
  schedulePreference: null,
  minutesPerWeek: null,
  limitationsNote: null,
  freeNotes: null,
  onboardingSkipped: false,
};

export async function getStudyProfile(): Promise<StudyProfileRow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_PROFILE;

  const { data } = await supabase
    .from("study_profiles")
    .select(
      "academic_goal, explanation_methods, session_duration_minutes, schedule_preference, minutes_per_week, limitations_note, free_notes, onboarding_skipped"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return EMPTY_PROFILE;

  return {
    academicGoal: data.academic_goal,
    explanationMethods: (data.explanation_methods ?? []) as ExplanationMethod[],
    sessionDurationMinutes: data.session_duration_minutes,
    schedulePreference: data.schedule_preference as SchedulePreference | null,
    minutesPerWeek: data.minutes_per_week,
    limitationsNote: data.limitations_note,
    freeNotes: data.free_notes,
    onboardingSkipped: data.onboarding_skipped,
  };
}

export interface SubjectConfidenceRow {
  subjectId: string;
  subjectName: string;
  /** Declared 1-5, or null when the student hasn't set one yet — never
   * defaulted to a number, per "evidencia todavía insuficiente". */
  declaredConfidence: number | null;
  /** Derived from recent study_sessions.comprehension_rating for this
   * subject — a *measured* signal, kept visually distinct from the
   * declared one instead of merged into it. */
  reportedAverage: number | null;
  reportedSessionCount: number;
}

/** My subjects (via subject_members, same pattern as materials.ts) plus
 * whatever confidence data exists for each — declared and derived. */
export async function listSubjectConfidence(): Promise<SubjectConfidenceRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: memberships }, { data: declared }, { data: sessions }] = await Promise.all([
    supabase.from("subject_members").select("subjects(id, name)").eq("user_id", user.id),
    supabase.from("study_subject_confidence").select("subject_id, confidence").eq("user_id", user.id),
    supabase
      .from("study_sessions")
      .select("subject_id, comprehension_rating")
      .eq("user_id", user.id)
      .not("comprehension_rating", "is", null)
      .not("subject_id", "is", null),
  ]);

  const subjects = (memberships ?? [])
    .flatMap((m) => (Array.isArray(m.subjects) ? m.subjects : m.subjects ? [m.subjects] : []))
    .filter((s): s is { id: string; name: string } => Boolean(s));

  const declaredMap = new Map((declared ?? []).map((d) => [d.subject_id, d.confidence]));

  const reportedBySubject = new Map<string, number[]>();
  for (const s of sessions ?? []) {
    if (!s.subject_id || s.comprehension_rating === null) continue;
    reportedBySubject.set(s.subject_id, [...(reportedBySubject.get(s.subject_id) ?? []), s.comprehension_rating]);
  }

  return subjects.map((s) => {
    const reported = reportedBySubject.get(s.id) ?? [];
    return {
      subjectId: s.id,
      subjectName: s.name,
      declaredConfidence: declaredMap.get(s.id) ?? null,
      reportedAverage: reported.length > 0 ? Math.round((reported.reduce((a, b) => a + b, 0) / reported.length) * 10) / 10 : null,
      reportedSessionCount: reported.length,
    };
  });
}
