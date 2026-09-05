"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingData {
  institutions: { id: string; name: string }[];
  careers: { id: string; institution_id: string; name: string }[];
  academicPeriods: { id: string; institution_id: string; career_id: string | null; name: string }[];
  subjects: { id: string; institution_id: string; name: string; code: string | null }[];
}

export async function getOnboardingData(): Promise<OnboardingData> {
  const supabase = await createClient();

  const [{ data: institutions }, { data: careers }, { data: academicPeriods }, { data: subjects }] =
    await Promise.all([
      supabase.from("institutions").select("id, name").order("name"),
      supabase.from("careers").select("id, institution_id, name").order("name"),
      supabase.from("academic_periods").select("id, institution_id, career_id, name").order("name"),
      supabase.from("subjects").select("id, institution_id, name, code").order("name"),
    ]);

  return {
    institutions: institutions ?? [],
    careers: careers ?? [],
    academicPeriods: academicPeriods ?? [],
    subjects: subjects ?? [],
  };
}

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const institutionId = formData.get("institution_id") as string;
  const careerId = (formData.get("career_id") as string) || null;
  const academicPeriodId = (formData.get("academic_period_id") as string) || null;
  const subjectIds = formData.getAll("subject_id") as string[];

  if (!institutionId) {
    throw new Error("Selecciona una institución para continuar.");
  }

  await supabase.from("student_enrollments").insert({
    user_id: user!.id,
    institution_id: institutionId,
    career_id: careerId,
    academic_period_id: academicPeriodId,
  });

  if (subjectIds.length > 0) {
    await supabase
      .from("subject_members")
      .insert(subjectIds.map((subjectId) => ({ subject_id: subjectId, user_id: user!.id, role: "STUDENT" as const })));
  }

  await supabase.from("notification_preferences").insert({ user_id: user!.id }).select().maybeSingle();

  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user!.id);

  redirect("/dashboard");
}
