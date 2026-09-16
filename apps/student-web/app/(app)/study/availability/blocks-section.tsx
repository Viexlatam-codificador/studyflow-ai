"use client";

import { useActionState, useTransition } from "react";
import { addAvailabilityBlock, deleteAvailabilityBlock, type AvailabilityFormState } from "@/lib/actions/availability";
import { AVAILABILITY_BLOCK_KINDS } from "@studyflow/shared";
import type { AvailabilityBlockRow } from "@/lib/data/availability";

const KIND_LABELS: Record<string, string> = {
  CLASS: "Clase",
  WORK: "Trabajo",
  OTHER: "Otro compromiso",
  STUDY_WINDOW: "Tiempo para estudiar",
};

const initialState: AvailabilityFormState = {};

export function BlocksSection({ blocks, weekdayLabels }: { blocks: AvailabilityBlockRow[]; weekdayLabels: string[] }) {
  const [state, formAction, pending] = useActionState(addAvailabilityBlock, initialState);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Bloques semanales</h2>
      <p className="text-sm text-foreground/60">
        Clases y trabajo para que StudyFlow nunca agende encima. &ldquo;Tiempo para estudiar&rdquo; es lo único
        que el planificador puede usar.
      </p>

      <div className="flex flex-col gap-2">
        {blocks.length === 0 && <p className="text-sm text-foreground/50">Aún no tienes bloques configurados.</p>}
        {blocks.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            <div>
              <span
                className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  b.kind === "STUDY_WINDOW" ? "bg-brand-success/10 text-brand-success" : "bg-foreground/5 text-foreground/60"
                }`}
              >
                {KIND_LABELS[b.kind]}
              </span>
              {weekdayLabels[b.dayOfWeek]} {b.startTime}–{b.endTime} {b.title ? `· ${b.title}` : ""}
            </div>
            <button
              disabled={isPending}
              onClick={() => {
                const fd = new FormData();
                fd.set("id", b.id);
                startTransition(() => deleteAvailabilityBlock(fd));
              }}
              className="text-foreground/30 hover:text-brand-urgent disabled:opacity-60"
              aria-label="Eliminar"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <form action={formAction} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <select name="kind" required defaultValue="STUDY_WINDOW" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {AVAILABILITY_BLOCK_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <select name="day_of_week" required defaultValue="1" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {weekdayLabels.map((label, i) => (
            <option key={i} value={i}>
              {label}
            </option>
          ))}
        </select>
        <input type="time" name="start_time" required defaultValue="18:00" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="time" name="end_time" required defaultValue="20:00" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input
          name="title"
          placeholder="Título opcional"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
        />

        {state.error && <p className="text-sm text-brand-urgent sm:col-span-2">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="brand-gradient self-start rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2"
        >
          {pending ? "Agregando…" : "Agregar bloque"}
        </button>
      </form>
    </div>
  );
}
