import { createClient } from "@/lib/supabase/server";
import { getAIProvider, AIProviderNotConfiguredError } from "@studyflow/ai-core";
import type { TaskWithSubject } from "@/lib/data/tasks";
import { tasksThisWeek } from "@/lib/data/weekly-summary";

export interface WeeklyNarrative {
  text: string;
  aiGenerated: boolean;
}

/** Short weekly briefing — "what's coming up and what matters most". Uses
 * AI for a natural-language version when the user has AI access; otherwise
 * falls back to a template built straight from the data, so this section
 * of the app never breaks or looks empty. */
export async function getWeeklyNarrative(userId: string, tasks: TaskWithSubject[]): Promise<WeeklyNarrative> {
  const weekTasks = tasksThisWeek(tasks).filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");

  if (weekTasks.length === 0) {
    return { text: "No tienes tareas ni evaluaciones con fecha esta semana — buen momento para adelantar algo.", aiGenerated: false };
  }

  const supabase = await createClient();
  const { data: entitlement } = await supabase
    .from("entitlements")
    .select("plan_key")
    .eq("user_id", userId)
    .maybeSingle();
  const hasAiAccess = (entitlement?.plan_key ?? "FREE") !== "FREE";

  if (hasAiAccess) {
    try {
      const provider = getAIProvider();
      const ranked = [...weekTasks].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
      const summaryInput = ranked.slice(0, 8).map((t) => ({
        title: t.title,
        asignatura: t.subjectName,
        vence: t.dueAt,
        peso_nota: t.gradeWeight,
        prioridad: t.priorityScore,
        estado: t.status,
      }));

      const result = await provider.complete({
        feature: "SMART_PLANNER",
        userId,
        maxTokens: 220,
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content:
              "Eres el asistente de StudyFlow AI. Escribe un resumen semanal breve (3-4 frases, español de Chile, " +
              "tono directo y motivador, sin emojis) para un estudiante, a partir de una lista JSON de tareas/evaluaciones " +
              "de esta semana ordenadas por prioridad. Menciona cuántas tiene, cuál es la más urgente y por qué, y una " +
              "recomendación concreta de por dónde empezar.",
          },
          { role: "user", content: JSON.stringify(summaryInput) },
        ],
      });

      if (result.content.trim()) {
        return { text: result.content.trim(), aiGenerated: true };
      }
    } catch (err) {
      if (!(err instanceof AIProviderNotConfiguredError)) {
        // Intentionally console.warn, not console.error — this is an expected,
        // handled fallback path (e.g. no OpenAI credits), and Next.js dev
        // treats console.error as an unhandled-exception-style overlay.
        console.warn("Weekly narrative AI generation failed, falling back to template:", err);
      }
    }
  }

  return { text: buildTemplateNarrative(weekTasks), aiGenerated: false };
}

function buildTemplateNarrative(weekTasks: TaskWithSubject[]): string {
  const ranked = [...weekTasks].sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
  const top = ranked[0];
  const evaluations = weekTasks.filter((t) => t.gradeWeight && t.gradeWeight > 0).length;

  const parts = [`Esta semana tienes ${weekTasks.length} pendiente${weekTasks.length === 1 ? "" : "s"}`];
  if (evaluations > 0) parts.push(`, ${evaluations} con nota asociada`);
  parts.push(".");

  if (top) {
    const dueLabel = top.dueAt
      ? new Date(top.dueAt).toLocaleDateString("es-CL", { weekday: "long", day: "numeric" })
      : "sin fecha";
    parts.push(` Lo más urgente es "${top.title}"${top.subjectName ? ` (${top.subjectName})` : ""}, vence el ${dueLabel}`);
    if (top.gradeWeight) parts.push(` y vale ${top.gradeWeight}% de la nota`);
    parts.push(". Te recomendamos empezar por ahí.");
  }

  return parts.join("");
}
