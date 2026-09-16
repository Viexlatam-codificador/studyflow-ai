import type { ObservationType, SessionMethod, StudyObservation } from "@studyflow/shared";

/**
 * Rule-based adaptation (master spec section 8). Every rule here is
 * transparent and documented — there is no scoring model, no ML, and no
 * automatic change to the student's plan or preferences. This module only
 * *proposes* observations; a human (the student) must confirm each one
 * before anything changes (see `confirmObservation` in student-web).
 */

/** No rule fires below this many relevant sessions — a single bad session
 * must never trigger a suggestion. */
export const MIN_EVIDENCE_SESSIONS = 3;

export interface SessionEvidence {
  subjectId: string | null;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  objectiveStatus: "COMPLETED" | "PARTIAL" | "PENDING";
  comprehensionRating: number | null; // 1..5
  difficultyRating: number | null; // 1..5
  methodUsed: SessionMethod | null;
  checkResult: { correct: number; total: number } | null;
}

function ratio(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

/** SHORTER_SESSIONS: of the longer-planned sessions (>=30 min), most ended
 * PARTIAL/PENDING — a sign the student tends to interrupt long blocks. */
function checkShorterSessions(evidence: SessionEvidence[]): StudyObservation | null {
  const longSessions = evidence.filter((e) => (e.plannedMinutes ?? 0) >= 30);
  if (longSessions.length < MIN_EVIDENCE_SESSIONS) return null;
  const interrupted = longSessions.filter((e) => e.objectiveStatus !== "COMPLETED");
  if (ratio(interrupted.length, longSessions.length) < 0.6) return null;

  return makeObservation("SHORTER_SESSIONS", null, longSessions.length, {
    rationale: `En tus últimas ${longSessions.length} sesiones largas, ${interrupted.length} terminaron sin completar el objetivo.`,
    suggestedChange: { field: "sessionDurationMinutes", value: 15 },
  });
}

/** LONGER_ESTIMATES: sessions that used all their planned time and still
 * ended PARTIAL/PENDING — the estimate for that work was probably too low. */
function checkLongerEstimates(subjectId: string | null, evidence: SessionEvidence[]): StudyObservation | null {
  if (evidence.length < MIN_EVIDENCE_SESSIONS) return null;
  const ranOut = evidence.filter(
    (e) => e.objectiveStatus !== "COMPLETED" && e.plannedMinutes && e.actualMinutes && e.actualMinutes >= e.plannedMinutes * 0.9
  );
  if (ratio(ranOut.length, evidence.length) < 0.6) return null;

  return makeObservation("LONGER_ESTIMATES", subjectId, evidence.length, {
    rationale: `En ${ranOut.length} de ${evidence.length} sesiones usaste todo el tiempo planificado y aun así quedó pendiente.`,
    suggestedChange: { field: "estimateMultiplier", value: 1.3 },
  });
}

/** MORE_PRACTICE: consistently low comprehension or check-result score. */
function checkMorePractice(subjectId: string | null, evidence: SessionEvidence[]): StudyObservation | null {
  if (evidence.length < MIN_EVIDENCE_SESSIONS) return null;
  const weak = evidence.filter((e) => {
    const lowComprehension = e.comprehensionRating !== null && e.comprehensionRating <= 2;
    const lowCheck = e.checkResult !== null && ratio(e.checkResult.correct, e.checkResult.total) < 0.6;
    return lowComprehension || lowCheck;
  });
  if (ratio(weak.length, evidence.length) < 0.6) return null;

  return makeObservation("MORE_PRACTICE", subjectId, evidence.length, {
    rationale: `Reportaste baja comprensión o resultados bajos en ${weak.length} de ${evidence.length} sesiones recientes.`,
    suggestedChange: { field: "method", value: "exercises" satisfies SessionMethod },
  });
}

/** DIFFERENT_METHOD: same method every time, with high reported difficulty. */
function checkDifferentMethod(subjectId: string | null, evidence: SessionEvidence[]): StudyObservation | null {
  if (evidence.length < MIN_EVIDENCE_SESSIONS) return null;
  const methodsUsed = new Set(evidence.map((e) => e.methodUsed).filter((m): m is SessionMethod => m !== null));
  if (methodsUsed.size !== 1) return null; // only fires when they haven't varied at all
  const hard = evidence.filter((e) => e.difficultyRating !== null && e.difficultyRating >= 4);
  if (ratio(hard.length, evidence.length) < 0.6) return null;

  const onlyMethod = [...methodsUsed][0];
  const alternatives: SessionMethod[] = ["examples", "steps", "diagrams", "exercises", "questions"];
  const next = alternatives.find((m) => m !== onlyMethod) ?? "mixed";

  return makeObservation("DIFFERENT_METHOD", subjectId, evidence.length, {
    rationale: `Usaste siempre "${onlyMethod}" y calificaste la dificultad como alta en ${hard.length} de ${evidence.length} sesiones.`,
    suggestedChange: { field: "method", value: next },
  });
}

function makeObservation(
  type: ObservationType,
  subjectId: string | null,
  evidenceCount: number,
  data: { rationale: string; suggestedChange: Record<string, unknown> }
): StudyObservation {
  return {
    id: "", // filled in by the caller when persisting
    userId: "", // filled in by the caller
    subjectId,
    type,
    evidenceCount,
    rationale: data.rationale,
    suggestedChange: data.suggestedChange,
    status: "PROPOSED",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Computes fresh observations from recent session evidence. `evidence`
 * should be the student's most recent sessions (caller decides the window,
 * e.g. last 10) — this function does not fetch or limit anything itself.
 */
export function computeObservations(evidence: SessionEvidence[]): StudyObservation[] {
  const observations: StudyObservation[] = [];

  const shorter = checkShorterSessions(evidence);
  if (shorter) observations.push(shorter);

  const bySubject = new Map<string | null, SessionEvidence[]>();
  for (const e of evidence) {
    const key = e.subjectId;
    bySubject.set(key, [...(bySubject.get(key) ?? []), e]);
  }

  for (const [subjectId, subjectEvidence] of bySubject) {
    const longer = checkLongerEstimates(subjectId, subjectEvidence);
    if (longer) observations.push(longer);
    const practice = checkMorePractice(subjectId, subjectEvidence);
    if (practice) observations.push(practice);
    const different = checkDifferentMethod(subjectId, subjectEvidence);
    if (different) observations.push(different);
  }

  return observations;
}
