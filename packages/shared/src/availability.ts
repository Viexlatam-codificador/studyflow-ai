/** A recurring weekly block (section 4). `CLASS`/`WORK`/`OTHER` are busy
 * time — the planner must never schedule inside them. `STUDY_WINDOW` is
 * time the student explicitly opened up for studying — the planner may
 * only schedule inside a `STUDY_WINDOW`, never in unlabeled empty time. */
export const AVAILABILITY_BLOCK_KINDS = ["CLASS", "WORK", "OTHER", "STUDY_WINDOW"] as const;
export type AvailabilityBlockKind = (typeof AVAILABILITY_BLOCK_KINDS)[number];

export interface AvailabilityBlock {
  id: string;
  userId: string;
  kind: AvailabilityBlockKind;
  title: string | null;
  /** 0 = Sunday .. 6 = Saturday, matching JS `Date#getDay()`. */
  dayOfWeek: number;
  /** "HH:MM", 24h, in the user's `AvailabilitySettings.timezone`. */
  startTime: string;
  endTime: string;
}

/** A one-off override for a specific calendar date (section 4). */
export const AVAILABILITY_EXCEPTION_KINDS = ["UNAVAILABLE", "EXTRA_AVAILABLE"] as const;
export type AvailabilityExceptionKind = (typeof AVAILABILITY_EXCEPTION_KINDS)[number];

export interface AvailabilityException {
  id: string;
  userId: string;
  exceptionDate: string; // "YYYY-MM-DD"
  kind: AvailabilityExceptionKind;
  /** null start/end on an UNAVAILABLE exception blocks the whole day. */
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

export interface AvailabilitySettings {
  userId: string;
  timezone: string; // IANA name, e.g. "America/Santiago"
  maxDailyMinutes: number;
  breakMinutes: number;
  breakEveryMinutes: number;
}

export const DEFAULT_AVAILABILITY_SETTINGS: Omit<AvailabilitySettings, "userId"> = {
  timezone: "America/Santiago",
  maxDailyMinutes: 180,
  breakMinutes: 10,
  breakEveryMinutes: 50,
};
