"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmObservation, dismissObservation } from "@/lib/actions/observations";
import type { ObservationRow } from "@/lib/data/observations";

const OBSERVATION_INTROS: Record<string, string> = {
  SHORTER_SESSIONS: "En tus últimas sesiones largas terminaste mejor los bloques más cortos.",
  LONGER_ESTIMATES: "Sueles necesitar más tiempo del planificado en este tipo de tarea.",
  MORE_PRACTICE: "Podría ayudarte más práctica antes de la próxima evaluación.",
  DIFFERENT_METHOD: "Probar otro método de explicación podría ayudarte.",
};

export function ObservationsPanel({ observations }: { observations: ObservationRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (observations.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {observations.map((o) => (
        <div key={o.id} className="rounded-2xl border border-brand-violet/30 bg-brand-violet/5 p-4">
          <p className="text-sm font-medium text-brand-violet">
            {OBSERVATION_INTROS[o.type] ?? "Observación"} {o.subjectName ? `(${o.subjectName})` : ""}
          </p>
          <p className="mt-1 text-sm text-foreground/70">{o.rationale}</p>
          <p className="mt-1 text-xs text-foreground/40">Basado en {o.evidenceCount} sesiones recientes — no es un diagnóstico.</p>
          <div className="mt-3 flex gap-3 text-sm">
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await confirmObservation(o.id);
                  router.refresh();
                })
              }
              className="font-medium text-brand-violet hover:underline disabled:opacity-60"
            >
              Probar este ajuste
            </button>
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await dismissObservation(o.id);
                  router.refresh();
                })
              }
              className="text-foreground/50 hover:text-foreground disabled:opacity-60"
            >
              No por ahora
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
