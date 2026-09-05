"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCareer(formData: FormData) {
  const supabase = await createClient();
  const institutionId = formData.get("institution_id") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("El nombre de la carrera es obligatorio.");

  const { error } = await supabase.from("careers").insert({ institution_id: institutionId, name });
  if (error) throw new Error(error.message);

  revalidatePath(`/institutions/${institutionId}`);
}

export async function createAcademicPeriod(formData: FormData) {
  const supabase = await createClient();
  const institutionId = formData.get("institution_id") as string;
  const careerId = (formData.get("career_id") as string) || null;
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("El nombre del semestre es obligatorio.");
  const isCurrent = formData.get("is_current") === "on";

  const { error } = await supabase
    .from("academic_periods")
    .insert({ institution_id: institutionId, career_id: careerId, name, is_current: isCurrent });
  if (error) throw new Error(error.message);

  revalidatePath(`/institutions/${institutionId}`);
}

export async function createSubject(formData: FormData) {
  const supabase = await createClient();
  const institutionId = formData.get("institution_id") as string;
  const academicPeriodId = (formData.get("academic_period_id") as string) || null;
  const careerId = (formData.get("career_id") as string) || null;
  const name = (formData.get("name") as string)?.trim();
  const code = (formData.get("code") as string) || null;
  if (!name) throw new Error("El nombre de la asignatura es obligatorio.");

  const { error } = await supabase.from("subjects").insert({
    institution_id: institutionId,
    academic_period_id: academicPeriodId,
    career_id: careerId,
    name,
    code,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/institutions/${institutionId}`);
}
