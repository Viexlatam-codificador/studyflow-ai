import { describe, expect, it } from "vitest";
import { computeObservations, MIN_EVIDENCE_SESSIONS, type SessionEvidence } from "./adaptation-engine";

function evidence(overrides: Partial<SessionEvidence>): SessionEvidence {
  return {
    subjectId: "math",
    plannedMinutes: 45,
    actualMinutes: 45,
    objectiveStatus: "COMPLETED",
    comprehensionRating: 4,
    difficultyRating: 2,
    methodUsed: "steps",
    checkResult: null,
    ...overrides,
  };
}

describe("computeObservations — minimum evidence", () => {
  it("proposes nothing with fewer than MIN_EVIDENCE_SESSIONS sessions, even if all look bad", () => {
    const evs = Array.from({ length: MIN_EVIDENCE_SESSIONS - 1 }, () =>
      evidence({ objectiveStatus: "PENDING", plannedMinutes: 45 })
    );
    expect(computeObservations(evs)).toHaveLength(0);
  });

  it("a single bad session never triggers a suggestion", () => {
    const evs = [evidence({}), evidence({}), evidence({ objectiveStatus: "PENDING" })];
    expect(computeObservations(evs)).toHaveLength(0);
  });
});

describe("SHORTER_SESSIONS", () => {
  it("fires when most long sessions end without completing the objective", () => {
    const evs = [
      evidence({ plannedMinutes: 45, objectiveStatus: "PARTIAL" }),
      evidence({ plannedMinutes: 45, objectiveStatus: "PENDING" }),
      evidence({ plannedMinutes: 45, objectiveStatus: "PARTIAL" }),
    ];
    const obs = computeObservations(evs);
    expect(obs.some((o) => o.type === "SHORTER_SESSIONS")).toBe(true);
  });

  it("does not fire when sessions are usually completed", () => {
    const evs = [
      evidence({ plannedMinutes: 45, objectiveStatus: "COMPLETED" }),
      evidence({ plannedMinutes: 45, objectiveStatus: "COMPLETED" }),
      evidence({ plannedMinutes: 45, objectiveStatus: "PARTIAL" }),
    ];
    const obs = computeObservations(evs);
    expect(obs.some((o) => o.type === "SHORTER_SESSIONS")).toBe(false);
  });
});

describe("LONGER_ESTIMATES", () => {
  it("fires when the student uses all planned time and still doesn't finish", () => {
    const evs = [
      evidence({ plannedMinutes: 30, actualMinutes: 30, objectiveStatus: "PARTIAL" }),
      evidence({ plannedMinutes: 30, actualMinutes: 29, objectiveStatus: "PENDING" }),
      evidence({ plannedMinutes: 30, actualMinutes: 30, objectiveStatus: "PARTIAL" }),
    ];
    const obs = computeObservations(evs);
    expect(obs.some((o) => o.type === "LONGER_ESTIMATES" && o.subjectId === "math")).toBe(true);
  });
});

describe("MORE_PRACTICE", () => {
  it("fires on repeated low comprehension", () => {
    const evs = [
      evidence({ comprehensionRating: 1 }),
      evidence({ comprehensionRating: 2 }),
      evidence({ comprehensionRating: 1 }),
    ];
    const obs = computeObservations(evs);
    expect(obs.some((o) => o.type === "MORE_PRACTICE")).toBe(true);
  });

  it("fires on repeated low check-result ratio", () => {
    const evs = [
      evidence({ comprehensionRating: 4, checkResult: { correct: 1, total: 5 } }),
      evidence({ comprehensionRating: 4, checkResult: { correct: 2, total: 6 } }),
      evidence({ comprehensionRating: 4, checkResult: { correct: 1, total: 4 } }),
    ];
    const obs = computeObservations(evs);
    expect(obs.some((o) => o.type === "MORE_PRACTICE")).toBe(true);
  });
});

describe("DIFFERENT_METHOD", () => {
  it("fires only when the same method was used every time with high difficulty", () => {
    const evs = [
      evidence({ methodUsed: "steps", difficultyRating: 5 }),
      evidence({ methodUsed: "steps", difficultyRating: 4 }),
      evidence({ methodUsed: "steps", difficultyRating: 5 }),
    ];
    const obs = computeObservations(evs);
    const found = obs.find((o) => o.type === "DIFFERENT_METHOD");
    expect(found).toBeDefined();
    expect(found?.suggestedChange.value).not.toBe("steps");
  });

  it("does not fire when the student already varies methods", () => {
    const evs = [
      evidence({ methodUsed: "steps", difficultyRating: 5 }),
      evidence({ methodUsed: "exercises", difficultyRating: 5 }),
      evidence({ methodUsed: "questions", difficultyRating: 5 }),
    ];
    const obs = computeObservations(evs);
    expect(obs.some((o) => o.type === "DIFFERENT_METHOD")).toBe(false);
  });
});

describe("observations are per-subject where relevant", () => {
  it("a struggling subject doesn't trigger MORE_PRACTICE for an unrelated subject", () => {
    const evs = [
      evidence({ subjectId: "math", comprehensionRating: 1 }),
      evidence({ subjectId: "math", comprehensionRating: 1 }),
      evidence({ subjectId: "math", comprehensionRating: 1 }),
      evidence({ subjectId: "history", comprehensionRating: 5 }),
      evidence({ subjectId: "history", comprehensionRating: 5 }),
      evidence({ subjectId: "history", comprehensionRating: 5 }),
    ];
    const obs = computeObservations(evs);
    const practice = obs.filter((o) => o.type === "MORE_PRACTICE");
    expect(practice.some((o) => o.subjectId === "math")).toBe(true);
    expect(practice.some((o) => o.subjectId === "history")).toBe(false);
  });
});
