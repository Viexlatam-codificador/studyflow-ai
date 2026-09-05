"use client";

import { useRef, useState, useTransition } from "react";
import { createTask } from "@/lib/actions/tasks";

export function NewTaskForm({ subjects }: { subjects: { id: string; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  return (
    <form
      ref={formRef}
      action={(formData) =>
        startTransition(async () => {
          await createTask(formData);
          formRef.current?.reset();
          setExpanded(false);
        })
      }
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <input
        name="title"
        placeholder="Nueva tarea — ej. Leer capítulo 4"
        required
        onFocus={() => setExpanded(true)}
        className="rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand-violet"
      />

      {expanded && (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjects.length > 0 && (
            <select name="subject_id" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Sin asignatura</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="datetime-local"
            name="due_at"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            name="grade_weight"
            placeholder="Peso de nota (%)"
            min={0}
            max={100}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            name="estimated_minutes"
            placeholder="Minutos estimados"
            min={0}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      )}

      {expanded && (
        <button
          type="submit"
          disabled={isPending}
          className="brand-gradient self-start rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Agregando…" : "Agregar tarea"}
        </button>
      )}
    </form>
  );
}
