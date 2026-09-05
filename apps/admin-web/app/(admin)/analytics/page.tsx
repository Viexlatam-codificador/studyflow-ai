import { createAdminClient } from "@/lib/supabase/admin";

export default async function AnalyticsPage() {
  const admin = createAdminClient();

  const [{ data: tasks }, { count: studySessions }, { count: inboxConfirmed }, { count: inboxTotal }] =
    await Promise.all([
      admin.from("tasks").select("status, due_at, updated_at"),
      admin.from("study_sessions").select("*", { count: "exact", head: true }),
      admin.from("inbox_items").select("*", { count: "exact", head: true }).eq("status", "CONFIRMED"),
      admin.from("inbox_items").select("*", { count: "exact", head: true }),
    ]);

  const completed = (tasks ?? []).filter((t) => t.status === "COMPLETED" || t.status === "SUBMITTED");
  const onTime = completed.filter((t) => !t.due_at || new Date(t.updated_at) <= new Date(t.due_at));
  const completionRate = tasks && tasks.length > 0 ? (completed.length / tasks.length) * 100 : 0;
  const onTimeRate = completed.length > 0 ? (onTime.length / completed.length) * 100 : 0;
  const inboxConfirmRate = inboxTotal ? ((inboxConfirmed ?? 0) / inboxTotal) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Analíticas</h1>
        <p className="text-foreground/60">
          KPIs agregados — sin afirmar mejora académica causal (ver docs/pilot/KPIS.md).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Tareas totales" value={tasks?.length ?? 0} />
        <Stat label="% completadas" value={`${completionRate.toFixed(1)}%`} />
        <Stat label="% completadas a tiempo" value={`${onTimeRate.toFixed(1)}%`} />
        <Stat label="Sesiones de estudio" value={studySessions ?? 0} />
        <Stat label="Inbox: capturas totales" value={inboxTotal ?? 0} />
        <Stat label="Inbox: % confirmadas" value={`${inboxConfirmRate.toFixed(1)}%`} />
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
