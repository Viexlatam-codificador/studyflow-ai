import { describe, expect, it } from "vitest";
import type { AvailabilityBlock, AvailabilityException, AvailabilitySettings } from "@studyflow/shared";
import {
  buildMicroStep,
  computeAvailableWindows,
  generateWeeklyPlan,
  QUICK_MINUTE_OPTIONS,
  type FixedPlanItem,
  type PlannableTask,
} from "./study-planner";

const TZ = "America/Santiago";
const NOW = new Date("2026-09-16T12:00:00.000Z"); // a Wednesday, per zoned-time.test.ts

function settings(overrides: Partial<AvailabilitySettings> = {}): AvailabilitySettings {
  return { userId: "u1", timezone: TZ, maxDailyMinutes: 180, breakMinutes: 10, breakEveryMinutes: 50, ...overrides };
}

function studyWindow(dayOfWeek: number, startTime: string, endTime: string): AvailabilityBlock {
  return { id: `w-${dayOfWeek}-${startTime}`, userId: "u1", kind: "STUDY_WINDOW", title: null, dayOfWeek, startTime, endTime };
}

function busyBlock(kind: "CLASS" | "WORK" | "OTHER", dayOfWeek: number, startTime: string, endTime: string): AvailabilityBlock {
  return { id: `b-${dayOfWeek}-${startTime}`, userId: "u1", kind, title: null, dayOfWeek, startTime, endTime };
}

function task(overrides: Partial<PlannableTask> & { id: string; title: string }): PlannableTask {
  return {
    subjectId: null,
    subjectName: null,
    dueAt: null,
    estimatedMinutes: null,
    gradeWeight: null,
    difficulty: null,
    progressPercentage: 0,
    status: "NEW",
    ...overrides,
  };
}

describe("computeAvailableWindows", () => {
  it("only treats STUDY_WINDOW blocks as free time, not empty hours", () => {
    // A CLASS block exists but no STUDY_WINDOW at all — must produce zero windows.
    const windows = computeAvailableWindows(NOW, TZ, [busyBlock("CLASS", 3, "09:00", "11:00")], [], settings(), [], 1);
    expect(windows).toHaveLength(0);
  });

  it("subtracts busy blocks that overlap a study window", () => {
    const blocks = [studyWindow(3, "18:00", "21:00"), busyBlock("WORK", 3, "19:00", "20:00")];
    const windows = computeAvailableWindows(NOW, TZ, blocks, [], settings(), [], 1);
    // 18-19 and 20-21 remain, 19-20 removed
    const totalMinutes = windows.reduce((s, w) => s + (w.endsAt.getTime() - w.startsAt.getTime()) / 60000, 0);
    expect(totalMinutes).toBeCloseTo(120, 0);
  });

  it("an UNAVAILABLE exception with no times blocks the whole day", () => {
    const blocks = [studyWindow(3, "18:00", "21:00")];
    const exceptions: AvailabilityException[] = [
      { id: "e1", userId: "u1", exceptionDate: "2026-09-16", kind: "UNAVAILABLE", startTime: null, endTime: null, note: null },
    ];
    const windows = computeAvailableWindows(NOW, TZ, blocks, exceptions, settings(), [], 1);
    expect(windows).toHaveLength(0);
  });

  it("an EXTRA_AVAILABLE exception adds time on that date only", () => {
    const exceptions: AvailabilityException[] = [
      { id: "e1", userId: "u1", exceptionDate: "2026-09-17", kind: "EXTRA_AVAILABLE", startTime: "10:00", endTime: "11:00", note: "feriado" },
    ];
    const windows = computeAvailableWindows(NOW, TZ, [], exceptions, settings(), [], 2);
    expect(windows).toHaveLength(1);
    expect(windows[0].dateStr).toBe("2026-09-17");
  });

  it("caps total daily minutes at maxDailyMinutes even with a huge window", () => {
    const blocks = [studyWindow(3, "08:00", "22:00")]; // 14h available
    const windows = computeAvailableWindows(NOW, TZ, blocks, [], settings({ maxDailyMinutes: 60 }), [], 1);
    const totalMinutes = windows.reduce((s, w) => s + (w.endsAt.getTime() - w.startsAt.getTime()) / 60000, 0);
    expect(totalMinutes).toBeLessThanOrEqual(60);
  });

  it("removes time already occupied by a fixed (completed/pinned) item", () => {
    const blocks = [studyWindow(3, "18:00", "20:00")];
    const fixed: FixedPlanItem[] = [
      { id: "f1", taskId: "t1", startsAt: "2026-09-16T22:00:00.000Z", endsAt: "2026-09-16T23:00:00.000Z" }, // 18-19 local (UTC-4)
    ];
    const windows = computeAvailableWindows(NOW, TZ, blocks, [], settings(), fixed, 1);
    const totalMinutes = windows.reduce((s, w) => s + (w.endsAt.getTime() - w.startsAt.getTime()) / 60000, 0);
    expect(totalMinutes).toBeLessThan(120);
  });
});

describe("generateWeeklyPlan", () => {
  const baseProfile = { sessionDurationMinutes: 30, explanationMethods: [] as never[] };

  it("student with only 15 minutes/day: never proposes a session longer than what's available", () => {
    const blocks = Array.from({ length: 7 }, (_, d) => studyWindow(d, "20:00", "20:15"));
    const tasks = [task({ id: "t1", title: "Guía de matemáticas", estimatedMinutes: 120, dueAt: "2026-09-25T00:00:00.000Z" })];
    const result = generateWeeklyPlan({
      now: NOW,
      timezone: TZ,
      tasks,
      availabilityBlocks: blocks,
      availabilityExceptions: [],
      settings: settings({ maxDailyMinutes: 15 }),
      profile: baseProfile,
      subjectConfidence: {},
      fixedItems: [],
    });
    for (const item of result.items) {
      const minutes = (new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime()) / 60000;
      expect(minutes).toBeLessThanOrEqual(15);
    }
    // 120 min of work at 15 min/day won't fully fit in 7 days (105 min max) — some must be unassigned.
    expect(result.unassignedMinutes).toBeGreaterThan(0);
  });

  it("student with a job: respects CLASS/WORK blocks and only schedules in STUDY_WINDOW time", () => {
    const blocks = [
      busyBlock("WORK", 1, "09:00", "18:00"),
      busyBlock("WORK", 2, "09:00", "18:00"),
      studyWindow(1, "19:00", "21:00"),
      studyWindow(2, "19:00", "21:00"),
    ];
    const tasks = [task({ id: "t1", title: "Informe", estimatedMinutes: 60, dueAt: "2026-09-25T00:00:00.000Z" })];
    const result = generateWeeklyPlan({
      now: NOW,
      timezone: TZ,
      tasks,
      availabilityBlocks: blocks,
      availabilityExceptions: [],
      settings: settings(),
      profile: baseProfile,
      subjectConfidence: {},
      fixedItems: [],
    });
    for (const item of result.items) {
      const local = new Date(item.startsAt);
      // every scheduled item must fall within one of the declared study windows (19-21 local Mon/Tue)
      expect(local.getUTCHours()).toBeGreaterThanOrEqual(22); // 19:00 CLT ~ 22:00-23:00 UTC in this period
    }
  });

  it("evaluation with impossible load reports unassigned work instead of overcommitting", () => {
    const blocks = [studyWindow(3, "18:00", "19:00")]; // 60 min/week only
    const tasks = [task({ id: "t1", title: "Examen final", estimatedMinutes: 600, dueAt: "2026-09-18T00:00:00.000Z", gradeWeight: 40 })];
    const result = generateWeeklyPlan({
      now: NOW,
      timezone: TZ,
      tasks,
      availabilityBlocks: blocks,
      availabilityExceptions: [],
      settings: settings(),
      profile: baseProfile,
      subjectConfidence: {},
      fixedItems: [],
      horizonDays: 7,
    });
    expect(result.unassignedMinutes).toBeGreaterThan(0);
    expect(result.unassignedByTask[0]?.taskId).toBe("t1");
  });

  it("tasks without a due date or duration still get a session with an editable estimate", () => {
    const blocks = [studyWindow(3, "18:00", "19:00")];
    const tasks = [task({ id: "t1", title: "Leer capítulo 3" })]; // no dueAt, no estimatedMinutes
    const result = generateWeeklyPlan({
      now: NOW,
      timezone: TZ,
      tasks,
      availabilityBlocks: blocks,
      availabilityExceptions: [],
      settings: settings(),
      profile: baseProfile,
      subjectConfidence: {},
      fixedItems: [],
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].objective).toMatch(/estimación editable/);
  });

  it("preserves fixed items by keeping their time unavailable to new sessions", () => {
    const blocks = [studyWindow(3, "18:00", "20:00")];
    const fixed: FixedPlanItem[] = [{ id: "f1", taskId: "old", startsAt: "2026-09-16T22:00:00.000Z", endsAt: "2026-09-16T23:00:00.000Z" }];
    const tasks = [task({ id: "t1", title: "Tarea nueva", estimatedMinutes: 30 })];
    const result = generateWeeklyPlan({
      now: NOW,
      timezone: TZ,
      tasks,
      availabilityBlocks: blocks,
      availabilityExceptions: [],
      settings: settings(),
      profile: baseProfile,
      subjectConfidence: {},
      fixedItems: fixed,
    });
    for (const item of result.items) {
      const overlaps = new Date(item.startsAt) < new Date(fixed[0].endsAt) && new Date(item.endsAt) > new Date(fixed[0].startsAt);
      expect(overlaps).toBe(false);
    }
  });

  it("never overlaps two generated sessions with each other", () => {
    const blocks = [studyWindow(3, "18:00", "22:00")];
    const tasks = [
      task({ id: "t1", title: "A", estimatedMinutes: 40, dueAt: "2026-09-20T00:00:00.000Z" }),
      task({ id: "t2", title: "B", estimatedMinutes: 40, dueAt: "2026-09-20T00:00:00.000Z", gradeWeight: 50 }),
    ];
    const result = generateWeeklyPlan({
      now: NOW,
      timezone: TZ,
      tasks,
      availabilityBlocks: blocks,
      availabilityExceptions: [],
      settings: settings(),
      profile: baseProfile,
      subjectConfidence: {},
      fixedItems: [],
    });
    const sorted = [...result.items].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    for (let i = 1; i < sorted.length; i++) {
      expect(new Date(sorted[i].startsAt).getTime()).toBeGreaterThanOrEqual(new Date(sorted[i - 1].endsAt).getTime());
    }
  });

  it("is deterministic/idempotent: identical input produces identical output", () => {
    const blocks = [studyWindow(3, "18:00", "20:00"), studyWindow(4, "18:00", "20:00")];
    const tasks = [task({ id: "t1", title: "Repaso", estimatedMinutes: 90, dueAt: "2026-09-25T00:00:00.000Z" })];
    const input = {
      now: NOW,
      timezone: TZ,
      tasks,
      availabilityBlocks: blocks,
      availabilityExceptions: [],
      settings: settings(),
      profile: baseProfile,
      subjectConfidence: {},
      fixedItems: [],
    };
    const a = generateWeeklyPlan(input);
    const b = generateWeeklyPlan(input);
    expect(a.items).toEqual(b.items);
    expect(a.unassignedMinutes).toBe(b.unassignedMinutes);
  });

  it("reserves a break inside a long window once the continuous-work threshold is crossed", () => {
    const blocks = [studyWindow(3, "18:00", "20:00")]; // 120 min window
    const tasks = [task({ id: "t1", title: "Repaso largo", estimatedMinutes: 120 })];
    const result = generateWeeklyPlan({
      now: NOW,
      timezone: TZ,
      tasks,
      availabilityBlocks: blocks,
      availabilityExceptions: [],
      settings: settings({ maxDailyMinutes: 180, breakMinutes: 15, breakEveryMinutes: 50 }),
      profile: { sessionDurationMinutes: 50, explanationMethods: [] },
      subjectConfidence: {},
      fixedItems: [],
    });
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    const gapMinutes = (new Date(result.items[1].startsAt).getTime() - new Date(result.items[0].endsAt).getTime()) / 60000;
    expect(gapMinutes).toBeGreaterThanOrEqual(15);
  });

  it("works with zero AI configured — it's a pure function, there's no AI dependency at all", () => {
    const blocks = [studyWindow(3, "18:00", "19:00")];
    const tasks = [task({ id: "t1", title: "Tarea", estimatedMinutes: 30 })];
    expect(() =>
      generateWeeklyPlan({
        now: NOW,
        timezone: TZ,
        tasks,
        availabilityBlocks: blocks,
        availabilityExceptions: [],
        settings: settings(),
        profile: baseProfile,
        subjectConfidence: {},
        fixedItems: [],
      })
    ).not.toThrow();
  });
});

describe("QUICK_MINUTE_OPTIONS", () => {
  it("matches the required presets", () => {
    expect(QUICK_MINUTE_OPTIONS).toEqual([5, 10, 15, 30, 60]);
  });
});

describe("buildMicroStep", () => {
  const t = task({ id: "t1", title: "Cálculo integral", estimatedMinutes: 180 });

  it("suggests a concrete small step for 10 minutes, not just the task name", () => {
    const step = buildMicroStep(t, 10, NOW);
    expect(step.toLowerCase()).toContain("10 minutos");
    expect(step).not.toBe(t.title);
    expect(step.length).toBeGreaterThan(t.title.length);
  });

  it("mentions the task is due tomorrow when relevant", () => {
    const dueTomorrow = task({ id: "t2", title: "Ensayo", dueAt: new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString() });
    const step = buildMicroStep(dueTomorrow, 10, NOW);
    expect(step).toMatch(/mañana/);
  });

  it("acknowledges the full task can be completed when it fits", () => {
    const small = task({ id: "t3", title: "Quiz corto", estimatedMinutes: 20 });
    const step = buildMicroStep(small, 60, NOW);
    expect(step).toMatch(/completar/);
  });
});
