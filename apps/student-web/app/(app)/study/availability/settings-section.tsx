"use client";

import { useActionState } from "react";
import { updateAvailabilitySettings, type AvailabilityFormState } from "@/lib/actions/availability";
import type { AvailabilitySettingsRow } from "@/lib/data/availability";

const COMMON_TIMEZONES = ["America/Santiago", "America/Buenos_Aires", "America/Bogota", "America/Mexico_City", "America/Lima"];

const initialState: AvailabilityFormState = {};

export function SettingsSection({ settings }: { settings: AvailabilitySettingsRow }) {
  const [state, formAction, pending] = useActionState(updateAvailabilitySettings, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Configuración general</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Zona horaria</span>
          <select name="timezone" defaultValue={settings.timezone} className="rounded-lg border border-border bg-background px-3 py-2">
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Máximo de minutos por día</span>
          <input
            type="number"
            name="max_daily_minutes"
            min={0}
            max={1440}
            defaultValue={settings.maxDailyMinutes}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Minutos de descanso</span>
          <input
            type="number"
            name="break_minutes"
            min={0}
            max={120}
            defaultValue={settings.breakMinutes}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Descanso cada (minutos)</span>
          <input
            type="number"
            name="break_every_minutes"
            min={5}
            max={480}
            defaultValue={settings.breakEveryMinutes}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </div>

      {state.error && <p className="text-sm text-brand-urgent">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="brand-gradient self-start rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar configuración"}
      </button>
    </form>
  );
}
