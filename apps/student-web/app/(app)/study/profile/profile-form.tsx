"use client";

import { useActionState, useState, useTransition } from "react";
import {
  upsertStudyProfile,
  skipStudyProfile,
  deleteStudyProfile,
  type ProfileFormState,
} from "@/lib/actions/study-profile";
import {
  EXPLANATION_METHODS,
  EXPLANATION_METHOD_LABELS,
  SCHEDULE_PREFERENCES,
  SCHEDULE_PREFERENCE_LABELS,
  type ExplanationMethod,
} from "@studyflow/shared";
import type { StudyProfileRow } from "@/lib/data/study-profile";

const initialState: ProfileFormState = {};

export function ProfileForm({ initial }: { initial: StudyProfileRow }) {
  const [state, formAction, pending] = useActionState(upsertStudyProfile, initialState);
  const [methods, setMethods] = useState<ExplanationMethod[]>(initial.explanationMethods);
  const [isPending, startTransition] = useTransition();

  function toggleMethod(m: ExplanationMethod) {
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">¿Cuál es tu objetivo académico ahora?</span>
        <textarea
          name="academic_goal"
          defaultValue={initial.academicGoal ?? ""}
          rows={2}
          placeholder="Ej: aprobar Cálculo II con nota sobre 5.0"
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <span className="text-sm font-medium">¿Cómo prefieres que te expliquen?</span>
        <div className="flex flex-wrap gap-2">
          {EXPLANATION_METHODS.map((m) => (
            <label
              key={m}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                methods.includes(m) ? "brand-gradient border-transparent text-white" : "border-border"
              }`}
            >
              <input
                type="checkbox"
                name="explanation_methods"
                value={m}
                checked={methods.includes(m)}
                onChange={() => toggleMethod(m)}
                className="hidden"
              />
              {EXPLANATION_METHOD_LABELS[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Duración preferida de sesión (min)</span>
          <input
            type="number"
            name="session_duration_minutes"
            min={5}
            max={240}
            defaultValue={initial.sessionDurationMinutes ?? ""}
            placeholder="Ej: 30"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Preferencia de horario</span>
          <select
            name="schedule_preference"
            defaultValue={initial.schedulePreference ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">Sin preferencia</option>
            {SCHEDULE_PREFERENCES.map((p) => (
              <option key={p} value={p}>
                {SCHEDULE_PREFERENCE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">Minutos disponibles por semana (aprox.)</span>
          <input
            type="number"
            name="minutes_per_week"
            min={0}
            max={10080}
            defaultValue={initial.minutesPerWeek ?? ""}
            placeholder="Ej: 300"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Limitaciones prácticas (opcional)</span>
        <input
          name="limitations_note"
          defaultValue={initial.limitationsNote ?? ""}
          placeholder="Ej: solo puedo estudiar de noche entre semana"
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Cuéntanos cómo estudias (opcional)</span>
        <textarea
          name="free_notes"
          defaultValue={initial.freeNotes ?? ""}
          rows={3}
          placeholder="Texto libre — se incluye como contexto al personalizar con Gemini, StudyFlow no lo interpreta automáticamente."
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      {state.error && <p className="text-sm text-brand-urgent">{state.error}</p>}
      {state.saved && <p className="text-sm text-brand-success">Perfil guardado.</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="brand-gradient rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar perfil"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => skipStudyProfile())}
          className="text-sm text-foreground/50 hover:text-foreground disabled:opacity-60"
        >
          Saltar por ahora
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (confirm("¿Borrar tu perfil de estudio? Puedes volver a completarlo cuando quieras.")) {
              startTransition(async () => deleteStudyProfile());
            }
          }}
          className="text-sm text-brand-urgent hover:underline disabled:opacity-60"
        >
          Borrar perfil
        </button>
      </div>
    </form>
  );
}
