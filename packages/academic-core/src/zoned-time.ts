/**
 * Timezone-correct wall-clock <-> instant conversion using only the
 * platform's built-in `Intl` — no date library dependency. Node bundles
 * full ICU (real IANA tzdata) by default since Node 13, so this reads the
 * *actual* historical/current DST rule for any zone (including Chile's,
 * which has changed more than once) instead of hardcoding an offset.
 */

function offsetMinutesAt(timeZone: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return (asUtc - instant.getTime()) / 60_000;
}

/**
 * Converts a wall-clock date+time in `timeZone` to the correct UTC instant,
 * accounting for that zone's DST rule at that specific date (fixed-point
 * iteration: the offset itself depends on the instant, so we refine twice,
 * which is enough for every real-world zone — offsets don't change within
 * a few minutes of an initial guess).
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naiveUtcMs = Date.parse(`${dateStr}T${timeStr}:00.000Z`);
  let instant = new Date(naiveUtcMs);
  for (let i = 0; i < 2; i++) {
    const offset = offsetMinutesAt(timeZone, instant);
    instant = new Date(naiveUtcMs - offset * 60_000);
  }
  return instant;
}

/** The inverse — reads the wall-clock date/time an instant falls on in `timeZone`. */
export function utcToZonedParts(
  instant: Date,
  timeZone: string
): { dateStr: string; timeStr: string; dayOfWeek: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday);
  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    timeStr: `${map.hour}:${map.minute}`,
    dayOfWeek: weekdayIndex,
  };
}

/** "YYYY-MM-DD" for `date`, as a plain UTC-midnight calendar day — used for
 * day arithmetic (adding N days), never for wall-clock conversion. */
export function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toDateStr(dt);
}

/** Monday of the week containing `dateStr` (ISO week start), computed on
 * the plain calendar date — matches `study_plans.week_start`. */
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const jsDay = dt.getUTCDay(); // 0=Sun..6=Sat
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  dt.setUTCDate(dt.getUTCDate() + diff);
  return toDateStr(dt);
}
