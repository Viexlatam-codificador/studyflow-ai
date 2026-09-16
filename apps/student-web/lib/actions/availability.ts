"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AVAILABILITY_BLOCK_KINDS, AVAILABILITY_EXCEPTION_KINDS } from "@studyflow/shared";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function revalidate() {
  revalidatePath("/study/availability");
  revalidatePath("/study/plan");
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TimeString = z.string().regex(TIME_RE, "Formato de hora inválido (HH:MM).");

const BlockSchema = z.object({
  kind: z.enum(AVAILABILITY_BLOCK_KINDS),
  title: z.string().trim().max(120).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: TimeString,
  endTime: TimeString,
});

export interface AvailabilityFormState {
  error?: string;
}

export async function addAvailabilityBlock(_prev: AvailabilityFormState, formData: FormData): Promise<AvailabilityFormState> {
  const { supabase, userId } = await requireUserId();

  const parsed = BlockSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title") || undefined,
    dayOfWeek: formData.get("day_of_week"),
    startTime: formData.get("start_time"),
    endTime: formData.get("end_time"),
  });
  if (!parsed.success) return { error: "Revisa los datos del bloque." };
  if (parsed.data.endTime <= parsed.data.startTime) return { error: "La hora de término debe ser después del inicio." };

  const { error } = await supabase.from("availability_blocks").insert({
    user_id: userId,
    kind: parsed.data.kind,
    title: parsed.data.title ?? null,
    day_of_week: parsed.data.dayOfWeek,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
  });
  if (error) return { error: error.message };

  revalidate();
  return {};
}

export async function deleteAvailabilityBlock(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = formData.get("id") as string;
  await supabase.from("availability_blocks").delete().eq("id", id).eq("user_id", userId);
  revalidate();
}

const ExceptionSchema = z.object({
  exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  kind: z.enum(AVAILABILITY_EXCEPTION_KINDS),
  startTime: TimeString.optional(),
  endTime: TimeString.optional(),
  note: z.string().trim().max(200).optional(),
});

export async function addAvailabilityException(_prev: AvailabilityFormState, formData: FormData): Promise<AvailabilityFormState> {
  const { supabase, userId } = await requireUserId();

  const startRaw = (formData.get("start_time") as string) || undefined;
  const endRaw = (formData.get("end_time") as string) || undefined;

  const parsed = ExceptionSchema.safeParse({
    exceptionDate: formData.get("exception_date"),
    kind: formData.get("kind"),
    startTime: startRaw,
    endTime: endRaw,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "Revisa los datos de la excepción." };
  if (parsed.data.kind === "EXTRA_AVAILABLE" && (!parsed.data.startTime || !parsed.data.endTime)) {
    return { error: "Para agregar disponibilidad extra indica hora de inicio y término." };
  }
  if (parsed.data.startTime && parsed.data.endTime && parsed.data.endTime <= parsed.data.startTime) {
    return { error: "La hora de término debe ser después del inicio." };
  }

  const { error } = await supabase.from("availability_exceptions").insert({
    user_id: userId,
    exception_date: parsed.data.exceptionDate,
    kind: parsed.data.kind,
    start_time: parsed.data.startTime ?? null,
    end_time: parsed.data.endTime ?? null,
    note: parsed.data.note ?? null,
  });
  if (error) return { error: error.message };

  revalidate();
  return {};
}

export async function deleteAvailabilityException(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const id = formData.get("id") as string;
  await supabase.from("availability_exceptions").delete().eq("id", id).eq("user_id", userId);
  revalidate();
}

const SettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(64),
  maxDailyMinutes: z.coerce.number().int().min(0).max(1440),
  breakMinutes: z.coerce.number().int().min(0).max(120),
  breakEveryMinutes: z.coerce.number().int().min(5).max(480),
});

export async function updateAvailabilitySettings(_prev: AvailabilityFormState, formData: FormData): Promise<AvailabilityFormState> {
  const { supabase, userId } = await requireUserId();

  const parsed = SettingsSchema.safeParse({
    timezone: formData.get("timezone"),
    maxDailyMinutes: formData.get("max_daily_minutes"),
    breakMinutes: formData.get("break_minutes"),
    breakEveryMinutes: formData.get("break_every_minutes"),
  });
  if (!parsed.success) return { error: "Revisa la configuración." };

  const { error } = await supabase.from("availability_settings").upsert({
    user_id: userId,
    timezone: parsed.data.timezone,
    max_daily_minutes: parsed.data.maxDailyMinutes,
    break_minutes: parsed.data.breakMinutes,
    break_every_minutes: parsed.data.breakEveryMinutes,
  });
  if (error) return { error: error.message };

  revalidate();
  return {};
}
