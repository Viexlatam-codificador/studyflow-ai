import { createClient } from "@/lib/supabase/server";
import type { SessionEvidence } from "@studyflow/academic-core";
import type { ObservationStatus, ObservationType, SessionMethod } from "@studyflow/shared";

const RECENT_SESSIONS_WINDOW = 15;

export async function listRecentSessionEvidence(): Promise<SessionEvidence[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("study_sessions")
    .select("subject_id, planned_minutes, actual_minutes, objective_status, comprehension_rating, difficulty_rating, method_used, check_result")
    .eq("user_id", user.id)
    .not("objective_status", "is", null)
    .order("started_at", { ascending: false })
    .limit(RECENT_SESSIONS_WINDOW);

  return (data ?? []).map((s) => ({
    subjectId: s.subject_id,
    plannedMinutes: s.planned_minutes,
    actualMinutes: s.actual_minutes,
    objectiveStatus: s.objective_status as "COMPLETED" | "PARTIAL" | "PENDING",
    comprehensionRating: s.comprehension_rating,
    difficultyRating: s.difficulty_rating,
    methodUsed: s.method_used as SessionMethod | null,
    checkResult: s.check_result as { correct: number; total: number } | null,
  }));
}

export interface ObservationRow {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  type: ObservationType;
  evidenceCount: number;
  rationale: string;
  suggestedChange: Record<string, unknown>;
  status: ObservationStatus;
  createdAt: string;
}

export async function listOpenObservations(): Promise<ObservationRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("study_observations")
    .select("id, subject_id, type, evidence_count, rationale, suggested_change, status, created_at, subjects(name)")
    .eq("user_id", user.id)
    .eq("status", "PROPOSED")
    .order("created_at", { ascending: false });

  return (data ?? []).map((o) => {
    const subject = Array.isArray(o.subjects) ? o.subjects[0] : o.subjects;
    return {
      id: o.id,
      subjectId: o.subject_id,
      subjectName: subject?.name ?? null,
      type: o.type as ObservationType,
      evidenceCount: o.evidence_count,
      rationale: o.rationale,
      suggestedChange: o.suggested_change as Record<string, unknown>,
      status: o.status as ObservationStatus,
      createdAt: o.created_at,
    };
  });
}
