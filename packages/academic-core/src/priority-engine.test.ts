import { describe, expect, it } from "vitest";
import { calculatePriorityScore, recommendForAvailableTime } from "./priority-engine";
import type { Task } from "@studyflow/shared";

const NOW = new Date("2026-08-31T12:00:00Z");

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? "task-1",
    userId: "user-1",
    institutionId: null,
    subjectId: null,
    title: "Test task",
    description: null,
    professorId: null,
    dueAt: null,
    startsAt: null,
    estimatedMinutes: 60,
    difficulty: 3,
    priorityScore: null,
    gradeWeight: null,
    status: "NEW",
    progressPercentage: 0,
    instructions: null,
    source: "MANUAL",
    sourceUrl: null,
    externalId: null,
    confidence: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("calculatePriorityScore", () => {
  it("scores an overdue, high-weight task near 100", () => {
    const score = calculatePriorityScore(
      { dueAt: "2026-08-30T00:00:00Z", estimatedMinutes: 120, gradeWeight: 30, difficulty: 5, progressPercentage: 0 },
      NOW
    );
    expect(score).toBeGreaterThan(70);
  });

  it("scores a distant, low-weight, mostly-done task low", () => {
    const score = calculatePriorityScore(
      { dueAt: "2026-10-15T00:00:00Z", estimatedMinutes: 30, gradeWeight: 5, difficulty: 1, progressPercentage: 90 },
      NOW
    );
    expect(score).toBeLessThan(30);
  });

  it("stays within 0-100 bounds", () => {
    const score = calculatePriorityScore(
      { dueAt: "2020-01-01T00:00:00Z", estimatedMinutes: 5000, gradeWeight: 500, difficulty: 5, progressPercentage: 0 },
      NOW
    );
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe("recommendForAvailableTime", () => {
  it("returns null when there are no actionable tasks", () => {
    expect(recommendForAvailableTime([], 30, NOW)).toBeNull();
  });

  it("prefers the highest-priority task among those that fit the available time", () => {
    const quickLowStakes = makeTask({ id: "quick", estimatedMinutes: 15, dueAt: "2026-10-01T00:00:00Z", gradeWeight: 5 });
    const urgentThatFits = makeTask({ id: "urgent", estimatedMinutes: 25, dueAt: "2026-09-01T00:00:00Z", gradeWeight: 30 });
    const recommendation = recommendForAvailableTime([quickLowStakes, urgentThatFits], 30, NOW);
    expect(recommendation?.task.id).toBe("urgent");
    expect(recommendation?.reason).toContain("vence");
  });

  it("falls back to the highest-priority task even if it doesn't fully fit, when nothing else fits", () => {
    const onlyBigTask = makeTask({ id: "big", estimatedMinutes: 180, dueAt: "2026-09-01T00:00:00Z", gradeWeight: 30 });
    const recommendation = recommendForAvailableTime([onlyBigTask], 30, NOW);
    expect(recommendation?.task.id).toBe("big");
    expect(recommendation?.reason).toContain("puedes avanzar");
  });

  it("prefers a task that fits over a higher-priority task that doesn't", () => {
    const quickLowStakes = makeTask({ id: "quick", estimatedMinutes: 15, dueAt: "2026-10-01T00:00:00Z", gradeWeight: 5 });
    const urgentTooBig = makeTask({ id: "urgent", estimatedMinutes: 120, dueAt: "2026-09-01T00:00:00Z", gradeWeight: 30 });
    const recommendation = recommendForAvailableTime([quickLowStakes, urgentTooBig], 30, NOW);
    expect(recommendation?.task.id).toBe("quick");
  });

  it("excludes completed and submitted tasks", () => {
    const done = makeTask({ id: "done", status: "COMPLETED" });
    const recommendation = recommendForAvailableTime([done], 30, NOW);
    expect(recommendation).toBeNull();
  });
});
