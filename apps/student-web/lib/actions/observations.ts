"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeObservations } from "@studyflow/academic-core";
import { listRecentSessionEvidence } from "@/lib/data/observations";

const UNIQUE_VIOLATION = "23505";

/**
 * Runs the rule-based adaptation check (section 8) and stores any newly
 * proposed observations. Never changes the student's plan or preferences
 * by itself — see `confirmObservation` for the only path that does, and
 * only after the student explicitly accepts.
 */
export async function computeAndPersistObservations(): Promise<{ created: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const evidence = await listRecentSessionEvidence();
  const observations = computeObservations(evidence);

  let created = 0;
  for (const obs of observations) {
    let existingQuery = supabase
      .from("study_observations")
      .select("id")
      .eq("user_id", user.id)
      .eq("type", obs.type)
      .eq("status", "PROPOSED");
    existingQuery = obs.subjectId === null ? existingQuery.is("subject_id", null) : existingQuery.eq("subject_id", obs.subjectId);
    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("study_observations").insert({
      user_id: user.id,
      subject_id: obs.subjectId,
      type: obs.type,
      evidence_count: obs.evidenceCount,
      rationale: obs.rationale,
      suggested_change: obs.suggestedChange,
    });
    // A concurrent request winning the same unique dedupe index is fine —
    // it means the observation now exists, which is exactly what we wanted.
    if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
    if (!error) created += 1;
  }

  if (created > 0) revalidatePath("/study/plan");
  return { created };
}

/** The student accepts an observation — this is the only place a
 * suggested change actually touches study_profiles (section 8, "el
 * alumno confirma la replanificación"). */
export async function confirmObservation(observationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: obs } = await supabase
    .from("study_observations")
    .select("id, suggested_change")
    .eq("id", observationId)
    .eq("user_id", user.id)
    .eq("status", "PROPOSED")
    .maybeSingle();
  if (!obs) return { error: "Esta observación ya no está disponible." };

  const change = obs.suggested_change as { field: string; value: unknown };
  if (change.field === "sessionDurationMinutes" && typeof change.value === "number") {
    await supabase.from("study_profiles").upsert({ user_id: user.id, session_duration_minutes: change.value });
  } else if (change.field === "method" && typeof change.value === "string") {
    // A method suggestion doesn't overwrite the whole preference list —
    // it's added as a hint the next plan generation will weigh, via
    // explanation_methods, without discarding the student's own choices.
    const { data: profile } = await supabase.from("study_profiles").select("explanation_methods").eq("user_id", user.id).maybeSingle();
    const current: string[] = profile?.explanation_methods ?? [];
    if (!current.includes(change.value)) {
      await supabase.from("study_profiles").upsert({ user_id: user.id, explanation_methods: [...current, change.value] });
    }
  } else if (change.field === "estimateMultiplier") {
    // Informational for now — no single profile field maps to "multiply
    // future estimates"; applying it per-task belongs to a future task-edit
    // flow. Recorded as accepted either way so it stops being re-proposed.
  }

  await supabase.from("study_observations").update({ status: "ACCEPTED", resolved_at: new Date().toISOString() }).eq("id", observationId);
  revalidatePath("/study/plan");
  revalidatePath("/study/profile");
  return {};
}

export async function dismissObservation(observationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("study_observations")
    .update({ status: "DISMISSED", resolved_at: new Date().toISOString() })
    .eq("id", observationId)
    .eq("user_id", user.id);
  revalidatePath("/study/plan");
}
