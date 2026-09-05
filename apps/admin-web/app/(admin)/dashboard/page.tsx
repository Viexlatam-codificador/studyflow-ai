import { getFounderMetrics } from "@/lib/data/admin-metrics";

export default async function AdminDashboardPage() {
  const m = await getFounderMetrics();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Founder Dashboard</h1>
        <p className="text-foreground/60">Métricas en vivo de StudyFlow AI.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Usuarios totales" value={m.totalUsers} />
        <Stat label="DAU" value={m.dau} />
        <Stat label="WAU" value={m.wau} />
        <Stat label="MAU" value={m.mau} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Free" value={m.planCounts.FREE ?? 0} />
        <Stat label="Pro" value={m.planCounts.PRO ?? 0} />
        <Stat label="Campus" value={m.planCounts.CAMPUS ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="MRR estimado" value={`$${m.mrrUsd.toFixed(2)}`} />
        <Stat label="Costo IA (histórico)" value={`$${m.aiCostUsd.toFixed(2)}`} />
        <Stat label="Tokens IA (in/out)" value={`${m.aiTokens.input} / ${m.aiTokens.output}`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Tareas creadas" value={m.tasksCreated} />
        <Stat label="Tareas completadas" value={m.tasksCompleted} />
        <Stat label="Sesiones de estudio" value={m.studySessions} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-foreground/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
