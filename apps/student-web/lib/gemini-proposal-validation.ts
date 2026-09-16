import "server-only";
import * as z from "zod";
import {
  GEMINI_PROPOSAL_MAX_CHARS,
  GEMINI_PROPOSAL_MAX_QUESTIONS,
  GEMINI_PROPOSAL_MAX_SUGGESTIONS,
  PREFERENCE_CHANGE_FIELDS,
  SESSION_METHODS,
  type GeminiProposal,
} from "@studyflow/shared";

/**
 * Strict, versioned validation for whatever the student pastes back from
 * Gemini (section 7). Deliberately conservative: no `eval`, no "smart"
 * parser that tries to salvage malformed input, no coercion of unexpected
 * shapes. Text fields are always treated as content to display, never as
 * code or as instructions to execute.
 */

const TaskSuggestionSchema = z.object({
  taskId: z.string().uuid(),
  objective: z.string().trim().min(1).max(2000),
  method: z.enum(SESSION_METHODS),
  estimatedMinutes: z.number().int().min(1).max(600),
});

const PreferenceChangeSchema = z.object({
  field: z.enum(PREFERENCE_CHANGE_FIELDS),
  value: z.union([z.string().max(500), z.number(), z.array(z.string().max(60)).max(10)]),
  reason: z.string().trim().max(500),
});

const GeminiProposalSchema = z.object({
  schemaVersion: z.number().int(),
  summary: z.string().trim().max(2000),
  suggestions: z.array(TaskSuggestionSchema).max(GEMINI_PROPOSAL_MAX_SUGGESTIONS),
  openQuestions: z.array(z.string().trim().max(500)).max(GEMINI_PROPOSAL_MAX_QUESTIONS),
  preferenceChanges: z.array(PreferenceChangeSchema).max(10),
});

export type ValidationOutcome =
  | { ok: true; proposal: GeminiProposal }
  | { ok: false; reason: "too_large" | "not_json" | "schema_mismatch" | "unsupported_version"; message: string; issues?: string[] };

/**
 * Pulls JSON out of the pasted text: accepts pure JSON, or exactly one
 * ```json fenced block. Multiple candidate blocks or no valid JSON at all
 * is rejected with a clear message rather than guessing.
 */
function extractJson(raw: string): { json: unknown } | { error: string } {
  const trimmed = raw.trim();

  try {
    return { json: JSON.parse(trimmed) };
  } catch {
    // fall through to fenced-block extraction
  }

  const fenced = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
  if (fenced.length === 0) return { error: "No encontramos un JSON válido ni un bloque ```json``` en el texto pegado." };
  if (fenced.length > 1) return { error: "Encontramos más de un bloque de código — pega solo la respuesta con un único bloque JSON." };

  try {
    return { json: JSON.parse(fenced[0][1].trim()) };
  } catch {
    return { error: "El bloque de código encontrado no es JSON válido." };
  }
}

export function validateGeminiProposal(raw: string, expectedSchemaVersion: number): ValidationOutcome {
  if (raw.length > GEMINI_PROPOSAL_MAX_CHARS) {
    return {
      ok: false,
      reason: "too_large",
      message: `El texto pegado es demasiado largo (${raw.length} caracteres, máximo ${GEMINI_PROPOSAL_MAX_CHARS}). Pide a Gemini una respuesta más breve.`,
    };
  }

  const extracted = extractJson(raw);
  if ("error" in extracted) {
    return { ok: false, reason: "not_json", message: extracted.error };
  }

  const parsed = GeminiProposalSchema.safeParse(extracted.json);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "schema_mismatch",
      message: "La respuesta no tiene el formato esperado — revisa que sea exactamente el JSON solicitado.",
      issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).slice(0, 20),
    };
  }

  if (parsed.data.schemaVersion !== expectedSchemaVersion) {
    return {
      ok: false,
      reason: "unsupported_version",
      message: `Esta respuesta usa la versión de contrato ${parsed.data.schemaVersion}, pero StudyFlow espera la versión ${expectedSchemaVersion}. Genera un contexto nuevo e inténtalo de nuevo.`,
    };
  }

  return { ok: true, proposal: parsed.data };
}
