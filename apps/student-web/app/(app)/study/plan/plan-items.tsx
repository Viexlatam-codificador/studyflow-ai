"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { utcToZonedParts } from "@studyflow/academic-core";
import { EXPLANATION_METHOD_LABELS, type ExplanationMethod } from "@studyflow/shared";
import { completeStudyPlanItem, setStudyPlanItemFixed } from "@/lib/actions/study-plan";
import type { StudyPlanItemRow } from "@/lib/data/study-plan";

const WEEKDAY_LABELS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function timeLabel(iso: string, timezone: string): string {
  return utcToZonedParts(new Date(iso), timezone).timeStr;
}

export function PlanItems({ items, timezone }: { items: StudyPlanItemRow[]; timezone: string }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-foreground/50">
        Este plan no tiene sesiones — agrega disponibilidad en &ldquo;Mi disponibilidad&rdquo; o pendientes en
        Tareas, y regenera el plan.
      </p>
    );
  }

  const byDay = new Map<string, StudyPlanItemRow[]>();
  for (const item of items) {
    const { dateStr } = utcToZonedParts(new Date(item.startsAt), timezone);
    byDay.set(dateStr, [...(byDay.get(dateStr) ?? []), item]);
  }
  const days = [...byDay.keys()].sort();

  return (
    <div className="flex flex-col gap-6">
      {days.map((dateStr) => {
        const dayItems = byDay.get(dateStr)!;
        const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
        return (
          <div key={dateStr}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground/50">
              {WEEKDAY_LABELS[dayOfWeek]} {dateStr.slice(8, 10)}/{dateStr.slice(5, 7)}
            </h3>
            <div className="flex flex-col gap-2">
              {dayItems.map((item) => (
                <PlanItemCard key={item.id} item={item} timezone={timezone} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlanItemCard({ item, timezone }: { item: StudyPlanItemRow; timezone: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const done = item.status === "COMPLETED";

  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-foreground/50">
            {timeLabel(item.startsAt, timezone)}–{timeLabel(item.endsAt, timezone)}
            {item.subjectName ? ` · ${item.subjectName}` : ""}
            {item.origin === "GEMINI" && <span className="ml-2 rounded-full bg-brand-violet/10 px-2 py-0.5 text-brand-violet">Gemini</span>}
          </p>
          <p className={`font-medium ${done ? "line-through" : ""}`}>{item.objective}</p>
          <p className="mt-1 text-xs text-foreground/50">{item.priorityReason}</p>
        </div>
        {item.isFixed && <span className="shrink-0 text-xs text-foreground/40">📌 fijada</span>}
      </div>

      {!done && (
        <div className="mt-3 flex items-center gap-3 text-xs">
          <button onClick={() => setExpanded((v) => !v)} className="font-medium text-brand-violet hover:underline">
            {expanded ? "Cerrar" : "Marcar completada"}
          </button>
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setStudyPlanItemFixed(item.id, !item.isFixed);
                router.refresh();
              })
            }
            className="text-foreground/50 hover:text-foreground disabled:opacity-60"
          >
            {item.isFixed ? "Desfijar" : "Fijar (no mover al regenerar)"}
          </button>
        </div>
      )}

      {expanded && <CompletionForm itemId={item.id} plannedMinutes={Math.round((new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime()) / 60000)} onDone={() => { setExpanded(false); router.refresh(); }} />}
    </div>
  );
}

function CompletionForm({ itemId, plannedMinutes, onDone }: { itemId: string; plannedMinutes: number; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-3 flex flex-col gap-3 border-t border-border pt-3 text-sm"
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const checkCorrect = formData.get("check_correct");
          const checkTotal = formData.get("check_total");
          const result = await completeStudyPlanItem({
            itemId,
            actualMinutes: Number(formData.get("actual_minutes") ?? plannedMinutes),
            objectiveStatus: formData.get("objective_status") as "COMPLETED" | "PARTIAL" | "PENDING",
            comprehensionRating: formData.get("comprehension_rating") ? Number(formData.get("comprehension_rating")) : null,
            difficultyRating: formData.get("difficulty_rating") ? Number(formData.get("difficulty_rating")) : null,
            methodUsed: (formData.get("method_used") as string) || null,
            comment: (formData.get("comment") as string) || null,
            checkCorrect: checkCorrect ? Number(checkCorrect) : null,
            checkTotal: checkTotal ? Number(checkTotal) : null,
          });
          if (result.error) setError(result.error);
          else onDone();
        })
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Minutos reales</span>
          <input type="number" name="actual_minutes" min={0} max={600} defaultValue={plannedMinutes} className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">¿Cómo quedó el objetivo?</span>
          <select name="objective_status" required className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="COMPLETED">Completado</option>
            <option value="PARTIAL">Parcial</option>
            <option value="PENDING">Pendiente</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Comprensión (1-5)</span>
          <input type="number" name="comprehension_rating" min={1} max={5} className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Dificultad percibida (1-5)</span>
          <input type="number" name="difficulty_rating" min={1} max={5} className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Método usado</span>
          <select name="method_used" className="rounded-lg border border-border bg-background px-3 py-2">
            <option value="">Sin especificar</option>
            {(Object.keys(EXPLANATION_METHOD_LABELS) as ExplanationMethod[]).map((m) => (
              <option key={m} value={m}>
                {EXPLANATION_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Correctas</span>
            <input type="number" name="check_correct" min={0} className="w-20 rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">de</span>
            <input type="number" name="check_total" min={0} className="w-20 rounded-lg border border-border bg-background px-3 py-2" />
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Comentario (opcional)</span>
        <textarea name="comment" rows={2} className="rounded-lg border border-border bg-background px-3 py-2" />
      </label>

      {error && <p className="text-brand-urgent">{error}</p>}

      <button type="submit" disabled={isPending} className="brand-gradient self-start rounded-full px-5 py-2 font-medium text-white disabled:opacity-60">
        {isPending ? "Guardando…" : "Guardar resultado"}
      </button>
    </form>
  );
}
