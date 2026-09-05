"use client";

import { useMemo, useState } from "react";
import { completeOnboarding, type OnboardingData } from "@/lib/actions/onboarding";

export function OnboardingForm({ data }: { data: OnboardingData }) {
  const [institutionId, setInstitutionId] = useState(data.institutions[0]?.id ?? "");

  const careers = useMemo(
    () => data.careers.filter((c) => c.institution_id === institutionId),
    [data.careers, institutionId]
  );
  const periods = useMemo(
    () => data.academicPeriods.filter((p) => p.institution_id === institutionId),
    [data.academicPeriods, institutionId]
  );
  const subjects = useMemo(
    () => data.subjects.filter((s) => s.institution_id === institutionId),
    [data.subjects, institutionId]
  );

  if (data.institutions.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground/70">
        Aún no hay instituciones configuradas. Un administrador debe crear una institución antes de
        que puedas continuar. Mientras tanto, ya puedes usar StudyFlow para tareas sin asignatura.
      </p>
    );
  }

  return (
    <form action={completeOnboarding} className="flex flex-col gap-6">
      <Section label="Institución">
        <select
          name="institution_id"
          value={institutionId}
          onChange={(e) => setInstitutionId(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2"
        >
          {data.institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </Section>

      {careers.length > 0 && (
        <Section label="Carrera">
          <select name="career_id" className="rounded-lg border border-border bg-background px-3 py-2">
            {careers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Section>
      )}

      {periods.length > 0 && (
        <Section label="Semestre">
          <select name="academic_period_id" className="rounded-lg border border-border bg-background px-3 py-2">
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Section>
      )}

      {subjects.length > 0 && (
        <Section label="Asignaturas">
          <div className="flex flex-col gap-2">
            {subjects.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="subject_id" value={s.id} defaultChecked />
                {s.name} {s.code ? <span className="text-foreground/50">({s.code})</span> : null}
              </label>
            ))}
          </div>
        </Section>
      )}

      <button type="submit" className="brand-gradient mt-2 rounded-full px-6 py-3 font-medium text-white">
        Continuar
      </button>
    </form>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground/70">{label}</span>
      {children}
    </div>
  );
}
