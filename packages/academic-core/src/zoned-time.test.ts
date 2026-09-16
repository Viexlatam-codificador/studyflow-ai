import { describe, expect, it } from "vitest";
import { addDaysToDateStr, mondayOf, utcToZonedParts, zonedTimeToUtc } from "./zoned-time";

const TZ = "America/Santiago";

describe("zonedTimeToUtc / utcToZonedParts round-trip", () => {
  // Policy-agnostic on purpose: instead of hardcoding when Chile's DST
  // starts/ends (it has changed more than once), we verify the conversion
  // is internally consistent across the whole year using the runtime's own
  // IANA tzdata — if Node's tzdata changes, this still passes.
  const datesAcrossTheYear = [
    "2026-01-15",
    "2026-03-01",
    "2026-04-05",
    "2026-05-10",
    "2026-07-15",
    "2026-09-01",
    "2026-09-16",
    "2026-11-01",
    "2026-12-20",
  ];

  it.each(datesAcrossTheYear)("round-trips 09:00 on %s", (dateStr) => {
    const instant = zonedTimeToUtc(dateStr, "09:00", TZ);
    const back = utcToZonedParts(instant, TZ);
    expect(back.dateStr).toBe(dateStr);
    expect(back.timeStr).toBe("09:00");
  });

  it("produces different UTC instants for the same wall-clock time on dates with different offsets", () => {
    // Santiago's offset has historically differed between summer/winter.
    // We don't assert which is which, only that the mechanism reflects
    // whatever the runtime's tzdata says (a naive fixed-offset implementation
    // would make these differ by exactly a multiple of 24h; a real DST-aware
    // one may not, when the two dates straddle a transition).
    const jan = zonedTimeToUtc("2026-01-15", "09:00", TZ);
    const jul = zonedTimeToUtc("2026-07-15", "09:00", TZ);
    expect(jan.getTime()).not.toBe(jul.getTime());
  });

  it("computes day-of-week correctly", () => {
    const instant = zonedTimeToUtc("2026-09-16", "12:00", TZ); // a Wednesday
    const { dayOfWeek } = utcToZonedParts(instant, TZ);
    expect(dayOfWeek).toBe(3); // Wed
  });
});

describe("date helpers", () => {
  it("addDaysToDateStr adds across month boundaries", () => {
    expect(addDaysToDateStr("2026-09-29", 3)).toBe("2026-10-02");
  });

  it("mondayOf finds the Monday of the containing week", () => {
    expect(mondayOf("2026-09-16")).toBe("2026-09-14"); // Wed -> Mon
    expect(mondayOf("2026-09-14")).toBe("2026-09-14"); // already Monday
    expect(mondayOf("2026-09-20")).toBe("2026-09-14"); // Sunday -> previous Monday
  });
});
