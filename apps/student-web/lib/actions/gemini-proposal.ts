"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GEMINI_PROPOSAL_SCHEMA_VERSION, type GeminiProposal } from "@studyflow/shared";
import type { GeminiTaskContent } from "@studyflow/academic-core";
import { listTasksForCurrentUser } from "@/lib/data/tasks";
import { getStudyProfile, listSubjectConfidence } from "@/lib/data/study-profile";
import { buildGeminiContext, formatContextForClipboard } from "@/lib/gemini-context";
import { validateGeminiProposal } from "@/lib/gemini-proposal-validation";
import { regeneratePlan } from "@/lib/actions/study-plan";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

export interface BuildContextResult {
  proposalId: string;
  contextText: string;
  taskCount: number;
}

/** Step 1-3 of "Personalizar con mi Gemini": build the compact context,
 * store its hash for the later staleness check, and hand back the exact
 * text the student will copy. Nothing is sent to Gemini by StudyFlow. */
export async function buildGeminiExport(selectedTaskIds: string[], includeGoal: boolean): Promise<BuildContextResult> {
  const { supabase, userId } = await requireUserId();

  const [allTasks, profile, subjectConfidenceRows] = await Promise.all([
    listTasksForCurrentUser(),
    getStudyProfile(),
    listSubjectConfidence(),
  ]);

  // Ownership is implicit: listTasksForCurrentUser already scopes to the
  // caller, so a selectedTaskIds entry that isn't in `allTasks` is simply
  // dropped rather than trusted.
  const validIds = new Set(allTasks.map((t) => t.id));
  const safeSelectedIds = selectedTaskIds.filter((id) => validIds.has(id));

  const subjectConfidence: Record<string, number> = {};
  for (const s of subjectConfidenceRows) if (s.declaredConfidence !== null) subjectConfidence[s.subjectId] = s.declaredConfidence;

  const context = buildGeminiContext(allTasks, {
    selectedTaskIds: safeSelectedIds,
    includeGoal,
    goal: profile.academicGoal,
    explanationMethods: profile.explanationMethods,
    sessionDurationMinutes: profile.sessionDurationMinutes,
    minutesAvailableThisWeek: profile.minutesPerWeek ?? 0,
    subjectConfidence,
  });

  const { data: row, error } = await supabase
    .from("gemini_proposals")
    .insert({
      user_id: userId,
      schema_version: context.schemaVersion,
      context_hash: context.contextHash,
      context_snapshot: context,
      status: "PENDING_EXPORT",
    })
    .select("id")
    .single();

  if (error || !row) throw new Error(error?.message ?? "No se pudo preparar el contexto.");

  return { proposalId: row.id, contextText: formatContextForClipboard(context), taskCount: context.tasks.length };
}

export interface ImportProposalState {
  error?: string;
  issues?: string[];
  proposal?: GeminiProposal;
}

/** Step 6-7: validate what the student pasted back. Never writes anything
 * to the plan yet — that only happens in `applyGeminiProposal`, after the
 * student reviews the diff and confirms (section 7). */
export async function importGeminiProposal(proposalId: string, rawResponse: string): Promise<ImportProposalState> {
  const { supabase, userId } = await requireUserId();

  const { data: row } = await supabase
    .from("gemini_proposals")
    .select("id, user_id, context_hash, context_snapshot")
    .eq("id", proposalId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return { error: "No se encontró el contexto exportado. Genera uno nuevo." };

  const validation = validateGeminiProposal(rawResponse, GEMINI_PROPOSAL_SCHEMA_VERSION);
  if (!validation.ok) {
    await supabase.from("gemini_proposals").update({ status: "INVALID", raw_response: rawResponse.slice(0, 20000) }).eq("id", proposalId);
    return { error: validation.message, issues: validation.issues };
  }

  // Staleness check (section 7): recompute the context a fresh export
  // would produce right now for the exact same task selection, and compare
  // hashes — if the underlying tasks/constraints changed since export,
  // reject rather than silently applying suggestions against old data.
  const currentTasks = await listTasksForCurrentUser();
  const snapshot = row.context_snapshot as { tasks: { taskId: string }[] };
  const selectedIds = snapshot.tasks.map((t) => t.taskId);
  const profile = await getStudyProfile();
  const subjectConfidenceRows = await listSubjectConfidence();
  const subjectConfidence: Record<string, number> = {};
  for (const s of subjectConfidenceRows) if (s.declaredConfidence !== null) subjectConfidence[s.subjectId] = s.declaredConfidence;

  const fresh = buildGeminiContext(currentTasks, {
    selectedTaskIds: selectedIds,
    includeGoal: (snapshot as { studentGoal?: string | null }).studentGoal !== undefined,
    goal: profile.academicGoal,
    explanationMethods: profile.explanationMethods,
    sessionDurationMinutes: profile.sessionDurationMinutes,
    minutesAvailableThisWeek: profile.minutesPerWeek ?? 0,
    subjectConfidence,
  });

  if (fresh.contextHash !== row.context_hash) {
    await supabase.from("gemini_proposals").update({ status: "STALE" }).eq("id", proposalId);
    return { error: "Tus tareas o preferencias cambiaron desde que exportaste este contexto. Genera un contexto nuevo antes de pegar la respuesta." };
  }

  // Ownership check on every suggested taskId — never trust Gemini's (or
  // an edited paste's) taskId just because it's a syntactically valid uuid.
  const ownedTaskIds = new Set(currentTasks.map((t) => t.id));
  const foreignSuggestion = validation.proposal.suggestions.find((s) => !ownedTaskIds.has(s.taskId));
  if (foreignSuggestion) {
    return { error: "La respuesta hace referencia a una tarea que no te pertenece o ya no existe." };
  }

  await supabase
    .from("gemini_proposals")
    .update({ status: "PENDING_REVIEW", raw_response: rawResponse.slice(0, 20000), proposal: validation.proposal })
    .eq("id", proposalId);

  revalidatePath("/study/gemini");
  return { proposal: validation.proposal };
}

export async function dismissGeminiProposal(proposalId: string) {
  const { supabase, userId } = await requireUserId();
  await supabase.from("gemini_proposals").update({ status: "REJECTED" }).eq("id", proposalId).eq("user_id", userId);
  revalidatePath("/study/gemini");
}

export interface ApplyProposalInput {
  proposalId: string;
  acceptedTaskIds: string[];
  acceptedPreferenceFields: string[];
}

/** The only place any of this actually gets written — after the student
 * has seen the diff and explicitly picked what to keep (section 7,
 * "guarda únicamente después de confirmar"). Suggestions become
 * `geminiContent` fed into the *same* engine-driven regenerate — Gemini
 * never places sessions on the calendar directly. */
export async function applyGeminiProposal(input: ApplyProposalInput): Promise<{ error?: string }> {
  const { supabase, userId } = await requireUserId();

  const { data: row } = await supabase
    .from("gemini_proposals")
    .select("id, status, proposal")
    .eq("id", input.proposalId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row || row.status !== "PENDING_REVIEW" || !row.proposal) {
    return { error: "Esta propuesta ya no está disponible para aplicar." };
  }

  const proposal = row.proposal as GeminiProposal;
  const accepted = new Set(input.acceptedTaskIds);
  const geminiContent: GeminiTaskContent = {};
  for (const s of proposal.suggestions) {
    if (!accepted.has(s.taskId)) continue;
    geminiContent[s.taskId] = { objective: s.objective, method: s.method, estimatedMinutes: s.estimatedMinutes };
  }

  const acceptedFields = new Set(input.acceptedPreferenceFields);
  for (const change of proposal.preferenceChanges) {
    if (!acceptedFields.has(change.field)) continue;
    if (change.field === "sessionDurationMinutes" && typeof change.value === "number") {
      await supabase.from("study_profiles").upsert({ user_id: userId, session_duration_minutes: change.value });
    } else if (change.field === "schedulePreference" && typeof change.value === "string") {
      await supabase.from("study_profiles").upsert({ user_id: userId, schedule_preference: change.value });
    } else if (change.field === "explanationMethods" && Array.isArray(change.value)) {
      await supabase.from("study_profiles").upsert({ user_id: userId, explanation_methods: change.value });
    }
  }

  if (Object.keys(geminiContent).length > 0) {
    const regenerateResult = await regeneratePlan(geminiContent);
    if (regenerateResult.error) return { error: regenerateResult.error };
  }

  await supabase.from("gemini_proposals").update({ status: "APPLIED", applied_at: new Date().toISOString() }).eq("id", input.proposalId);

  revalidatePath("/study/gemini");
  revalidatePath("/study/plan");
  revalidatePath("/study/profile");
  return {};
}
