"use server";

import * as z from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EXPLANATION_METHODS, SCHEDULE_PREFERENCES } from "@studyflow/shared";

const ProfileSchema = z.object({
  academicGoal: z.string().trim().max(500).optional(),
  explanationMethods: z.array(z.enum(EXPLANATION_METHODS)).max(EXPLANATION_METHODS.length),
  sessionDurationMinutes: z.coerce.number().int().min(5).max(240).optional(),
  schedulePreference: z.enum(SCHEDULE_PREFERENCES).optional(),
  minutesPerWeek: z.coerce.number().int().min(0).max(10080).optional(),
  limitationsNote: z.string().trim().max(1000).optional(),
  freeNotes: z.string().trim().max(4000).optional(),
});

export interface ProfileFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  saved?: boolean;
}

async function requireUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export async function upsertStudyProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const { supabase, userId } = await requireUserId();

  const parsed = ProfileSchema.safeParse({
    academicGoal: formData.get("academic_goal") || undefined,
    explanationMethods: formData.getAll("explanation_methods"),
    sessionDurationMinutes: formData.get("session_duration_minutes") || undefined,
    schedulePreference: formData.get("schedule_preference") || undefined,
    minutesPerWeek: formData.get("minutes_per_week") || undefined,
    limitationsNote: formData.get("limitations_note") || undefined,
    freeNotes: formData.get("free_notes") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const { error } = await supabase.from("study_profiles").upsert({
    user_id: userId,
    academic_goal: parsed.data.academicGoal ?? null,
    explanation_methods: parsed.data.explanationMethods,
    session_duration_minutes: parsed.data.sessionDurationMinutes ?? null,
    schedule_preference: parsed.data.schedulePreference ?? null,
    minutes_per_week: parsed.data.minutesPerWeek ?? null,
    limitations_note: parsed.data.limitationsNote ?? null,
    free_notes: parsed.data.freeNotes ?? null,
    onboarding_skipped: false,
  });

  if (error) return { error: error.message };

  revalidatePath("/study/profile");
  revalidatePath("/study/gemini");
  return { saved: true };
}

export async function skipStudyProfile() {
  const { supabase, userId } = await requireUserId();
  await supabase.from("study_profiles").upsert({ user_id: userId, onboarding_skipped: true });
  revalidatePath("/study/profile");
  redirect("/study");
}

export async function deleteStudyProfile() {
  const { supabase, userId } = await requireUserId();
  await supabase.from("study_profiles").delete().eq("user_id", userId);
  revalidatePath("/study/profile");
}

const ConfidenceSchema = z.object({
  subjectId: z.string().uuid(),
  confidence: z.coerce.number().int().min(1).max(5),
});

export async function setSubjectConfidence(formData: FormData) {
  const { supabase, userId } = await requireUserId();

  const parsed = ConfidenceSchema.safeParse({
    subjectId: formData.get("subject_id"),
    confidence: formData.get("confidence"),
  });
  if (!parsed.success) throw new Error("Datos de confianza inválidos.");

  // Ownership check: only allow setting confidence for a subject the
  // student is actually enrolled in — never trust the id alone.
  const { data: membership } = await supabase
    .from("subject_members")
    .select("subject_id")
    .eq("user_id", userId)
    .eq("subject_id", parsed.data.subjectId)
    .maybeSingle();
  if (!membership) throw new Error("No perteneces a esa asignatura.");

  const { error } = await supabase.from("study_subject_confidence").upsert({
    user_id: userId,
    subject_id: parsed.data.subjectId,
    confidence: parsed.data.confidence,
    source: "DECLARED",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/study/profile");
}

export async function deleteSubjectConfidence(formData: FormData) {
  const { supabase, userId } = await requireUserId();
  const subjectId = formData.get("subject_id") as string;
  await supabase.from("study_subject_confidence").delete().eq("user_id", userId).eq("subject_id", subjectId);
  revalidatePath("/study/profile");
}
