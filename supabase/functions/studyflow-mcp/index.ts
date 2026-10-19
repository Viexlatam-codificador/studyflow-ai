import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@^2.0.0";
import { pipeline } from "npm:@supabase/middleware@1";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1";
import { z } from "npm:zod@^4.3.6";

type SupabaseClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }> };
  from: (table: string) => any;
};

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

async function currentUserId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("No fue posible verificar la cuenta del alumno.");
  return data.user.id;
}

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function registerStudyFlowTools(server: McpServer, supabase: SupabaseClient) {
  server.registerTool(
    "get_student_learning_context",
    {
      title: "Obtener contexto de aprendizaje",
      description:
        "Lee las preferencias declaradas y la confianza por asignatura del alumno autenticado. Son preferencias que pueden cambiar, no un diagnóstico ni un estilo de aprendizaje fijo.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      const userId = await currentUserId(supabase);
      const [profileResult, confidenceResult] = await Promise.all([
        supabase
          .from("study_profiles")
          .select(
            "academic_goal, explanation_methods, session_duration_minutes, schedule_preference, minutes_per_week, limitations_note, free_notes, updated_at"
          )
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("study_subject_confidence")
          .select("subject_id, confidence, source, updated_at, subjects(name, code)")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false }),
      ]);
      throwOnError(profileResult.error);
      throwOnError(confidenceResult.error);
      return json({
        profile: profileResult.data,
        subjectConfidence: confidenceResult.data ?? [],
        interpretationRule:
          "Trata estos datos como preferencias e hipótesis revisables. Valida con desempeño, comprensión reportada y una comprobación independiente.",
      });
    }
  );

  server.registerTool(
    "list_upcoming_academic_work",
    {
      title: "Listar trabajo académico próximo",
      description:
        "Lista tareas y evaluaciones próximas del alumno para priorizar una sesión de estudio según fecha, peso, dificultad y progreso.",
      inputSchema: z.object({
        days: z.number().int().min(1).max(90).default(14),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ days, limit }) => {
      const userId = await currentUserId(supabase);
      const from = new Date();
      const to = new Date(from.getTime() + days * 86_400_000);
      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, title, description, due_at, starts_at, estimated_minutes, difficulty, priority_score, grade_weight, status, progress_percentage, subject_id, subjects(name, code)"
        )
        .eq("user_id", userId)
        .not("status", "in", '("COMPLETED","SUBMITTED")')
        .gte("due_at", from.toISOString())
        .lte("due_at", to.toISOString())
        .order("due_at", { ascending: true })
        .limit(limit);
      throwOnError(error);
      return json({ window: { from: from.toISOString(), to: to.toISOString() }, items: data ?? [] });
    }
  );

  server.registerTool(
    "get_active_study_plan",
    {
      title: "Obtener plan de estudio activo",
      description: "Lee el plan semanal activo y sus bloques, objetivos, métodos y resultados esperados.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      const userId = await currentUserId(supabase);
      const { data: plan, error: planError } = await supabase
        .from("study_plans")
        .select("id, title, starts_on, ends_on, week_start, generated_at, unassigned_minutes")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      throwOnError(planError);
      if (!plan) return json({ plan: null, items: [], message: "El alumno todavía no tiene un plan activo." });

      const { data: items, error: itemsError } = await supabase
        .from("study_plan_items")
        .select(
          "id, task_id, subject_id, scheduled_date, scheduled_minutes, starts_at, ends_at, objective, method, expected_result, priority_reason, status, is_fixed, tasks(title, due_at, grade_weight), subjects(name, code)"
        )
        .eq("study_plan_id", plan.id)
        .order("starts_at", { ascending: true });
      throwOnError(itemsError);
      return json({ plan, items: items ?? [] });
    }
  );

  server.registerTool(
    "get_learning_evidence",
    {
      title: "Obtener evidencia de aprendizaje",
      description:
        "Lee resultados recientes y sugerencias transparentes de adaptación. Mantiene separados el tiempo, la comprensión declarada y el resultado de una comprobación.",
      inputSchema: z.object({
        subjectId: z.uuid().optional(),
        limit: z.number().int().min(3).max(30).default(10),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ subjectId, limit }) => {
      const userId = await currentUserId(supabase);
      let sessionsQuery = supabase
        .from("study_sessions")
        .select(
          "id, subject_id, goal, planned_minutes, actual_minutes, objective_status, comprehension_rating, difficulty_rating, method_used, check_result, started_at, ended_at, subjects(name, code)"
        )
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(limit);
      let observationsQuery = supabase
        .from("study_observations")
        .select("id, subject_id, type, evidence_count, rationale, suggested_change, status, created_at")
        .eq("user_id", userId)
        .eq("status", "PROPOSED")
        .order("created_at", { ascending: false });
      if (subjectId) {
        sessionsQuery = sessionsQuery.eq("subject_id", subjectId);
        observationsQuery = observationsQuery.eq("subject_id", subjectId);
      }
      const [sessionsResult, observationsResult] = await Promise.all([sessionsQuery, observationsQuery]);
      throwOnError(sessionsResult.error);
      throwOnError(observationsResult.error);
      return json({
        sessions: sessionsResult.data ?? [],
        proposedAdaptations: observationsResult.data ?? [],
        evidenceRule:
          "No concluyas dominio por una sola sesión. Busca patrones repetidos y distingue ayuda recibida de desempeño independiente.",
      });
    }
  );

  server.registerTool(
    "build_personalized_tutoring_brief",
    {
      title: "Preparar tutoría personalizada",
      description:
        "Construye un encargo de tutoría guiada a partir de preferencias y evidencia reciente. Úsalo antes de enseñar un tema al alumno.",
      inputSchema: z.object({
        topic: z.string().trim().min(2).max(200),
        subjectId: z.uuid().optional(),
        availableMinutes: z.number().int().min(5).max(240).optional(),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ topic, subjectId, availableMinutes }) => {
      const userId = await currentUserId(supabase);
      const { data: profile, error: profileError } = await supabase
        .from("study_profiles")
        .select("academic_goal, explanation_methods, session_duration_minutes, schedule_preference, limitations_note")
        .eq("user_id", userId)
        .maybeSingle();
      throwOnError(profileError);

      let evidenceQuery = supabase
        .from("study_sessions")
        .select("objective_status, comprehension_rating, difficulty_rating, method_used, check_result, planned_minutes, actual_minutes")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(10);
      if (subjectId) evidenceQuery = evidenceQuery.eq("subject_id", subjectId);
      const { data: evidence, error: evidenceError } = await evidenceQuery;
      throwOnError(evidenceError);

      const methods = profile?.explanation_methods?.length
        ? profile.explanation_methods
        : ["examples", "steps", "questions"];
      const minutes = availableMinutes ?? profile?.session_duration_minutes ?? 25;
      return json({
        topic,
        availableMinutes: minutes,
        learnerContext: {
          academicGoal: profile?.academic_goal ?? null,
          declaredPreferences: methods,
          limitations: profile?.limitations_note ?? null,
          recentEvidence: evidence ?? [],
        },
        teachingProtocol: [
          "Empieza con una pregunta breve para saber qué entiende ahora; no supongas su nivel.",
          "Pide un intento o una explicación propia antes de mostrar una solución completa.",
          "Si se bloquea, entrega pistas graduales: orientación, primer paso y ejemplo parcial.",
          `Explica en pasos pequeños y prueba primero estos formatos declarados: ${methods.join(", ")}. Cámbialos si la evidencia muestra dificultad.`,
          "Señala el paso exacto del error y explica por qué; evita limitarte a decir correcto o incorrecto.",
          "Cierra con un ejercicio semejante pero nuevo, resuelto sin ayuda, para comprobar transferencia.",
          "Pregunta comprensión y dificultad por separado. No confundas rapidez, confianza o tiempo con dominio.",
          "Sugiere una revisión breve posterior para comprobar retención sin apoyo.",
        ],
        adaptationPolicy: {
          minimumEvidence: "Usa al menos tres sesiones comparables antes de proponer un patrón estable.",
          studentControl: "Presenta toda adaptación como propuesta y deja que el alumno la acepte o descarte.",
          noFixedLabels: "No describas al alumno como visual, auditivo ni con otro estilo fijo.",
          privacy: "No pidas credenciales institucionales ni datos ajenos a la tutoría.",
        },
      });
    }
  );
}

Deno.serve(
  pipeline(
    [
      withOAuthProtectedResource({ authorizationServer: Deno.env.get("MCP_AUTH_ISSUER") }),
      withSupabase({ auth: "user" }),
    ],
    async (req, { supabase }) => {
      const handler = createMcpHandler(() => {
        const server = new McpServer({ name: "StudyFlow Tutor", version: "0.1.0" });
        registerStudyFlowTools(server, supabase as SupabaseClient);
        return server;
      });
      return handler.fetch(req);
    }
  )
);
