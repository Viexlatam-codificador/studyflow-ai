"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CalendarTheme } from "@/lib/calendar-themes";

export async function updateCalendarTheme(theme: CalendarTheme) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").update({ calendar_theme: theme }).eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/calendar");
}

/** Drag-and-drop reschedule: keeps the task's existing time-of-day (or
 * defaults to end-of-day) and moves it to `newDateKey` (YYYY-MM-DD). */
export async function rescheduleTask(taskId: string, newDateKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: task } = await supabase.from("tasks").select("due_at").eq("id", taskId).single();

  const previous = task?.due_at ? new Date(task.due_at) : null;
  const [year, month, day] = newDateKey.split("-").map(Number);
  const newDate = new Date(
    year,
    month - 1,
    day,
    previous ? previous.getHours() : 23,
    previous ? previous.getMinutes() : 59
  );

  const { error } = await supabase.from("tasks").update({ due_at: newDate.toISOString() }).eq("id", taskId);
  if (error) throw new Error(error.message);

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

/** Returns the student's existing calendar_feed_token, generating one on
 * first use — used to build the subscribable .ics URL for Google/Apple/
 * Outlook calendars (see app/api/calendar/[token]/route.ts). */
export async function getOrCreateCalendarFeedToken(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("calendar_feed_token").eq("id", user.id).single();
  if (profile?.calendar_feed_token) return profile.calendar_feed_token;

  const token = crypto.randomUUID();
  const { error } = await supabase.from("profiles").update({ calendar_feed_token: token }).eq("id", user.id);
  if (error) throw new Error(error.message);

  return token;
}

/** Invalidates the previous feed URL (e.g. if it was shared by mistake)
 * and issues a new one. */
export async function regenerateCalendarFeedToken(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const token = crypto.randomUUID();
  const { error } = await supabase.from("profiles").update({ calendar_feed_token: token }).eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/calendar");
  return token;
}
