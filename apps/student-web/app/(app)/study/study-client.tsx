"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { recommendForAvailableTime } from "@studyflow/academic-core";
import type { TaskWithSubject } from "@/lib/data/tasks";
import { startStudySession, endStudySession } from "@/lib/actions/study";

const TIME_OPTIONS = [15, 30, 45, 60, 90, 120];

export function StudyClient({ tasks }: { tasks: TaskWithSubject[] }) {
  const [availableMinutes, setAvailableMinutes] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPending, startTransition] = useTransition();

  const recommendation = useMemo(
    () => (availableMinutes ? recommendForAvailableTime(tasks, availableMinutes) : null),
    [availableMinutes, tasks]
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
      <div className="flex flex-wrap gap-2">
        {TIME_OPTIONS.map((m) => (
          <button
            key={m}
            onClick={() => setAvailableMinutes(m)}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              availableMinutes === m ? "brand-gradient border-transparent text-white" : "border-border"
            }`}
          >
            {m} min
          </button>
        ))}
      </div>

      {availableMinutes && !recommendation && (
        <p className="text-sm text-foreground/50">No tienes tareas pendientes — ¡vas al día!</p>
      )}

      {recommendation && (
        <div className="rounded-2xl border border-brand-violet/40 bg-card p-6">
          <p className="mb-1 text-sm font-medium text-brand-violet">Lo mejor que puedes hacer ahora</p>
          <p className="text-lg font-semibold">{recommendation.task.title}</p>
          <p className="mt-2 text-sm text-foreground/60">{recommendation.reason}</p>
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
        </div>
      )}
    </div>
  );
}
