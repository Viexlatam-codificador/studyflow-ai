import { createClient } from "@/lib/supabase/server";
import { createCareer, createAcademicPeriod, createSubject } from "@/lib/actions/academic";

export default async function InstitutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: institution }, { data: careers }, { data: periods }, { data: subjects }] = await Promise.all([
    supabase.from("institutions").select("id, name").eq("id", id).single(),
    supabase.from("careers").select("id, name").eq("institution_id", id).order("name"),
    supabase.from("academic_periods").select("id, name, career_id, is_current").eq("institution_id", id).order("name"),
    supabase.from("subjects").select("id, name, code, career_id, academic_period_id").eq("institution_id", id).order("name"),
  ]);

  if (!institution) {
    return <p className="text-foreground/60">Institución no encontrada.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{institution.name}</h1>
        <p className="text-foreground/60">Carreras, semestres y asignaturas.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Carreras</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {(careers ?? []).map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card px-3 py-2">
              {c.name}
            </li>
          ))}
          {(careers ?? []).length === 0 && <li className="text-foreground/40">Sin carreras aún.</li>}
        </ul>
        <form action={createCareer} className="flex gap-2">
          <input type="hidden" name="institution_id" value={id} />
          <input name="name" placeholder="Nombre de la carrera" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm font-medium">
            Crear carrera
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Semestres</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {(periods ?? []).map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-card px-3 py-2">
              {p.name} {p.is_current && <span className="text-brand-success">· actual</span>}
            </li>
          ))}
          {(periods ?? []).length === 0 && <li className="text-foreground/40">Sin semestres aún.</li>}
        </ul>
        <form action={createAcademicPeriod} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="institution_id" value={id} />
          <input name="name" placeholder="Ej: 2026-2" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select name="career_id" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Sin carrera específica</option>
            {(careers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="is_current" /> Actual
          </label>
          <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm font-medium">
            Crear semestre
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Asignaturas</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {(subjects ?? []).map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-card px-3 py-2">
              {s.name} {s.code ? <span className="text-foreground/50">({s.code})</span> : null}
            </li>
          ))}
          {(subjects ?? []).length === 0 && <li className="text-foreground/40">Sin asignaturas aún.</li>}
        </ul>
        <form action={createSubject} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="institution_id" value={id} />
          <input name="name" placeholder="Nombre de la asignatura" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input name="code" placeholder="Código (opcional)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select name="career_id" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Sin carrera específica</option>
            {(careers ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="academic_period_id" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="">Sin semestre específico</option>
            {(periods ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-full border border-border px-4 py-2 text-sm font-medium">
            Crear asignatura
          </button>
        </form>
      </section>
    </div>
  );
}
