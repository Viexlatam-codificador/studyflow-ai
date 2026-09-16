import "server-only";
import { createHash } from "crypto";
import type { GeminiContextExport } from "@studyflow/shared";
import { GEMINI_PROPOSAL_SCHEMA_VERSION } from "@studyflow/shared";
import type { TaskWithSubject } from "@/lib/data/tasks";

/** Deterministic hash of exactly the fields the contract exposes — used to
 * detect a stale proposal (section 7: "rechaza propuestas obsoletas si las
 * tareas o restricciones relevantes cambiaron desde la exportación"). Two
 * exports of the same underlying state must hash identically; any relevant
 * change must hash differently. */
export function hashContext(context: Omit<GeminiContextExport, "contextHash" | "generatedAt">): string {
  const canonical = JSON.stringify(context, Object.keys(context).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export interface BuildContextOptions {
  selectedTaskIds: string[];
  includeGoal: boolean;
  goal: string | null;
  explanationMethods: string[];
  sessionDurationMinutes: number | null;
  minutesAvailableThisWeek: number;
  subjectConfidence: Record<string, number>;
}

export function buildGeminiContext(allTasks: TaskWithSubject[], opts: BuildContextOptions): GeminiContextExport {
  const selected = allTasks.filter((t) => opts.selectedTaskIds.includes(t.id));

  const base = {
    schemaVersion: GEMINI_PROPOSAL_SCHEMA_VERSION,
    studentGoal: opts.includeGoal ? opts.goal : null,
    preferences: {
      explanationMethods: opts.explanationMethods,
      sessionDurationMinutes: opts.sessionDurationMinutes,
      minutesAvailableThisWeek: opts.minutesAvailableThisWeek,
    },
    tasks: selected.map((t) => ({
      taskId: t.id,
      title: t.title,
      subjectName: t.subjectName,
      dueAt: t.dueAt,
      estimatedMinutes: t.estimatedMinutes,
      gradeWeight: t.gradeWeight,
      confidence: t.subjectId ? opts.subjectConfidence[t.subjectId] ?? null : null,
    })),
    instructions:
      "Eres un tutor de estudio. Responde SOLO con un bloque JSON que cumpla exactamente este contrato: " +
      '{"schemaVersion": number, "summary": string, "suggestions": [{"taskId": string, "objective": string, ' +
      '"method": "examples"|"steps"|"diagrams"|"exercises"|"questions"|"mixed", "estimatedMinutes": number}], ' +
      '"openQuestions": string[], "preferenceChanges": [{"field": string, "value": string|number|string[], "reason": string}]}. ' +
      "Usa solo los taskId de la lista de tareas de este contexto. Si falta información para dar una buena " +
      "recomendación, pregúntala en openQuestions en vez de inventarla. Adapta cada objective/method a las " +
      "preferencias declaradas y respeta minutesAvailableThisWeek en tus estimatedMinutes totales.",
  };

  const contextHash = hashContext(base);

  return { ...base, generatedAt: new Date().toISOString(), contextHash };
}

/** Formats the context as the actual text the student copies and pastes
 * into Gemini — the JSON contract plus the instructions, in one block. */
export function formatContextForClipboard(context: GeminiContextExport): string {
  return JSON.stringify(context, null, 2);
}
