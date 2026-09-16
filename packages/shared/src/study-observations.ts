/** Rule-based, transparent adaptation suggestions (section 8). Each type
 * maps to one documented rule in `packages/academic-core/study-planner.ts`
 * (`computeObservations`) — there is no hidden scoring or ML here, just a
 * minimum-evidence threshold per rule so a single bad session never
 * triggers a change. */
export const OBSERVATION_TYPES = [
  "SHORTER_SESSIONS",
  "LONGER_ESTIMATES",
  "MORE_PRACTICE",
  "DIFFERENT_METHOD",
] as const;
export type ObservationType = (typeof OBSERVATION_TYPES)[number];

export const OBSERVATION_STATUSES = ["PROPOSED", "ACCEPTED", "DISMISSED"] as const;
export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number];

export interface StudyObservation {
  id: string;
  userId: string;
  subjectId: string | null;
  type: ObservationType;
  /** How many sessions this observation is based on — always >= the rule's
   * documented minimum (see MIN_EVIDENCE_SESSIONS in academic-core). */
  evidenceCount: number;
  rationale: string;
  suggestedChange: Record<string, unknown>;
  status: ObservationStatus;
  createdAt: string;
}
