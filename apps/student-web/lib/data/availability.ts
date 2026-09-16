import { createClient } from "@/lib/supabase/server";
import { DEFAULT_AVAILABILITY_SETTINGS, type AvailabilityBlockKind, type AvailabilityExceptionKind } from "@studyflow/shared";

export interface AvailabilityBlockRow {
  id: string;
  kind: AvailabilityBlockKind;
  title: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface AvailabilityExceptionRow {
  id: string;
  exceptionDate: string;
  kind: AvailabilityExceptionKind;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

export interface AvailabilitySettingsRow {
  timezone: string;
  maxDailyMinutes: number;
  breakMinutes: number;
  breakEveryMinutes: number;
}

export interface AvailabilityData {
  blocks: AvailabilityBlockRow[];
  exceptions: AvailabilityExceptionRow[];
  settings: AvailabilitySettingsRow;
}

export async function getAvailability(): Promise<AvailabilityData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { blocks: [], exceptions: [], settings: DEFAULT_AVAILABILITY_SETTINGS };

  const [{ data: blocks }, { data: exceptions }, { data: settings }] = await Promise.all([
    supabase
      .from("availability_blocks")
      .select("id, kind, title, day_of_week, start_time, end_time")
      .eq("user_id", user.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("availability_exceptions")
      .select("id, exception_date, kind, start_time, end_time, note")
      .eq("user_id", user.id)
      .order("exception_date", { ascending: true }),
    supabase
      .from("availability_settings")
      .select("timezone, max_daily_minutes, break_minutes, break_every_minutes")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return {
    blocks: (blocks ?? []).map((b) => ({
      id: b.id,
      kind: b.kind as AvailabilityBlockKind,
      title: b.title,
      dayOfWeek: b.day_of_week,
      // Postgres `time` comes back as "HH:MM:SS" — trim to "HH:MM" for the UI/engine contract.
      startTime: b.start_time.slice(0, 5),
      endTime: b.end_time.slice(0, 5),
    })),
    exceptions: (exceptions ?? []).map((e) => ({
      id: e.id,
      exceptionDate: e.exception_date,
      kind: e.kind as AvailabilityExceptionKind,
      startTime: e.start_time ? e.start_time.slice(0, 5) : null,
      endTime: e.end_time ? e.end_time.slice(0, 5) : null,
      note: e.note,
    })),
    settings: settings
      ? {
          timezone: settings.timezone,
          maxDailyMinutes: settings.max_daily_minutes,
          breakMinutes: settings.break_minutes,
          breakEveryMinutes: settings.break_every_minutes,
        }
      : DEFAULT_AVAILABILITY_SETTINGS,
  };
}
