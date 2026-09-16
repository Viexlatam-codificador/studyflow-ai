"use client";

import { useActionState, useState, useTransition } from "react";
import { addAvailabilityException, deleteAvailabilityException, type AvailabilityFormState } from "@/lib/actions/availability";
import type { AvailabilityExceptionRow } from "@/lib/data/availability";

const initialState: AvailabilityFormState = {};

export function ExceptionsSection({ exceptions }: { exceptions: AvailabilityExceptionRow[] }) {
  const [state, formAction, pending] = useActionState(addAvailabilityException, initialState);
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<"UNAVAILABLE" | "EXTRA_AVAILABLE">("UNAVAILABLE");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Excepciones de una fecha</h2>
      <p className="text-sm text-foreground/60">
        Para un día puntual: bloquear todo (ej. viaje) o abrir tiempo extra (ej. feriado).
      </p>

      <div className="flex flex-col gap-2">
        {exceptions.length === 0 && <p className="text-sm text-foreground/50">Sin excepciones registradas.</p>}
        {exceptions.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            <div>
              <span
                className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  e.kind === "EXTRA_AVAILABLE" ? "bg-brand-success/10 text-brand-success" : "bg-brand-urgent/10 text-brand-urgent"
                }`}
              >
                {e.kind === "EXTRA_AVAILABLE" ? "Extra disponible" : "No disponible"}
              </span>
              {e.exceptionDate} {e.startTime ? `${e.startTime}–${e.endTime}` : "(todo el día)"} {e.note ? `· ${e.note}` : ""}
            </div>
            <button
              disabled={isPending}
              onClick={() => {
                const fd = new FormData();
                fd.set("id", e.id);
                startTransition(() => deleteAvailabilityException(fd));
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
        <input type="date" name="exception_date" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as "UNAVAILABLE" | "EXTRA_AVAILABLE")}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="UNAVAILABLE">No disponible</option>
          <option value="EXTRA_AVAILABLE">Extra disponible</option>
        </select>
        <input
          type="time"
          name="start_time"
          required={kind === "EXTRA_AVAILABLE"}
          placeholder="Inicio (opcional si es todo el día)"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          type="time"
          name="end_time"
          required={kind === "EXTRA_AVAILABLE"}
          placeholder="Término"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <input name="note" placeholder="Nota opcional" className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />

        {state.error && <p className="text-sm text-brand-urgent sm:col-span-2">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="brand-gradient self-start rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2"
        >
          {pending ? "Agregando…" : "Agregar excepción"}
        </button>
      </form>
    </div>
  );
}
