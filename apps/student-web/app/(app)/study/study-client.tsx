"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { recommendForAvailableTime, buildMicroStep, QUICK_MINUTE_OPTIONS } from "@studyflow/academic-core";
import type { TaskWithSubject } from "@/lib/data/tasks";
import { startStudySession, endStudySession, setPreferredAiProvider } from "@/lib/actions/study";
import { AI_PROVIDERS, buildAiUrl, buildStudyPrompt, type AiProvider } from "@/lib/ai-study-prompt";
import { formatShortDate } from "@/lib/format-date";

export function StudyClient({
  tasks,
  initialProvider,
  subjects,
}: {
  tasks: TaskWithSubject[];
  initialProvider: AiProvider | null;
  subjects: { id: string; name: string }[];
}) {
  const [availableMinutes, setAvailableMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [reviewSubject, setReviewSubject] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [provider, setProvider] = useState<AiProvider | null>(initialProvider);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function chooseProvider(next: AiProvider) {
    setProvider(next);
    startTransition(() => setPreferredAiProvider(next));
  }

  async function studyWithAi(task: TaskWithSubject) {
    if (!provider) return;
    const prompt = buildStudyPrompt({
      title: task.title,
      description: task.description,
      subjectName: task.subjectName,
      dueAt: task.dueAt ? formatShortDate(new Date(task.dueAt)) : null,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus("Texto copiado al portapapeles — pégalo en el chat que se abrió.");
    } catch {
      setCopyStatus("No pudimos copiar automáticamente — copia el texto desde la tarea.");
    }
    window.open(buildAiUrl(provider, prompt), "_blank", "noopener,noreferrer");
  }

  const recommendation = useMemo(
    () => (availableMinutes ? recommendForAvailableTime(tasks, availableMinutes) : null),
    [availableMinutes, tasks]
  );

  const microStep = useMemo(
    () =>
      recommendation && availableMinutes
        ? buildMicroStep(recommendation.task as TaskWithSubject, availableMinutes, new Date())
        : null,
    [recommendation, availableMinutes]
  );

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  if (sessionId) {
    const task = recommendation?.task;
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-foreground/60">Sesión en curso</p>
        <p className="mt-1 text-lg font-semibold">{task?.title ?? "Sesión libre"}</p>
        <p className="mt-4 text-4xl font-semibold tabular-nums">
          {String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:{String(elapsedSeconds % 60).padStart(2, "0")}
        </p>

        <form
          action={(formData) => startTransition(() => endStudySession(formData))}
          className="mt-6 flex flex-col gap-3"
        >
          <input type="hidden" name="session_id" value={sessionId} />
          <input type="hidden" name="task_id" value={task?.id ?? ""} />
          <input type="hidden" name="actual_minutes" value={Math.round(elapsedSeconds / 60)} />

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">¿Qué lograste?</span>
            <textarea
              name="outcome_notes"
              rows={2}
              className="rounded-lg border border-border bg-background px-3 py-2"
              placeholder="Ej: avancé el benchmark, me faltan 2 competidores."
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Avance logrado (%)</span>
            <input
              type="number"
              name="progress_gained"
              min={0}
              max={100}
              defaultValue={10}
              className="rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="brand-gradient rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isPending ? "Guardando…" : "Terminar sesión"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_MINUTE_OPTIONS.map((m) => (
          <button
            key={m}
            onClick={() => {
              setAvailableMinutes(m);
              setCustomMinutes("");
            }}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              availableMinutes === m ? "brand-gradient border-transparent text-white" : "border-border"
            }`}
          >
            {m} min
          </button>
        ))}
        <input
          type="number"
          min={1}
          max={600}
          value={customMinutes}
          onChange={(e) => {
            setCustomMinutes(e.target.value);
            const n = Number(e.target.value);
            setAvailableMinutes(n > 0 ? n : null);
          }}
          placeholder="Otro (min)"
          className="w-28 rounded-full border border-border bg-background px-4 py-2 text-sm"
        />
      </div>

      {availableMinutes && !recommendation && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-foreground/60">No tienes tareas pendientes para recomendarte algo ahora.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/inbox" className="brand-gradient rounded-full px-4 py-2 text-sm font-medium text-white">
              Crear mi primera tarea
            </Link>
          </div>
          {subjects.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-foreground/50">O elige un tema para repasar sin una tarea puntual:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setReviewSubject(s.name)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      reviewSubject === s.name ? "brand-gradient border-transparent text-white" : "border-border"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              {reviewSubject && availableMinutes && (
                <p className="mt-3 text-sm text-foreground/70">
                  {buildMicroStep({ id: "review", title: reviewSubject, subjectId: null, subjectName: reviewSubject, dueAt: null, estimatedMinutes: null, gradeWeight: null, difficulty: null, progressPercentage: 0, status: "NEW" }, availableMinutes, new Date())}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {recommendation && (
        <div className="rounded-2xl border border-brand-violet/40 bg-card p-6">
          <p className="mb-1 text-sm font-medium text-brand-violet">Lo mejor que puedes hacer ahora</p>
          <p className="text-lg font-semibold">{recommendation.task.title}</p>
          <p className="mt-2 text-sm text-foreground/60">{recommendation.reason}</p>
          {microStep && (
            <p className="mt-3 rounded-lg bg-brand-violet/5 p-3 text-sm text-foreground/80">{microStep}</p>
          )}
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const id = await startStudySession(recommendation.task.id, availableMinutes!);
                setSessionId(id);
                setElapsedSeconds(0);
              })
            }
            className="brand-gradient mt-4 rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isPending ? "Iniciando…" : "Comenzar sesión"}
          </button>

          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-foreground/70">¿Con qué IA prefieres estudiar?</p>
            <div className="flex flex-wrap gap-2">
              {AI_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => chooseProvider(p.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    provider === p.id ? "brand-gradient border-transparent text-white" : "border-border"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {provider && (
              <>
                <button
                  onClick={() => studyWithAi(recommendation.task as TaskWithSubject)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-violet/40 bg-brand-violet/5 px-4 py-3 text-sm font-semibold text-brand-violet transition hover:border-brand-violet hover:bg-brand-violet/10 active:scale-[0.98]"
                >
                  🤖 Estudiar esta tarea con {AI_PROVIDERS.find((p) => p.id === provider)?.label}
                </button>
                <p className="mt-2 text-xs text-foreground/40">
                  {AI_PROVIDERS.find((p) => p.id === provider)?.note}
                </p>
                {copyStatus && <p className="mt-1 text-xs text-brand-violet">{copyStatus}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
