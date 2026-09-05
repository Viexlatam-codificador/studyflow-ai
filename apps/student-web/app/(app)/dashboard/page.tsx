import Link from "next/link";
import { listTasksForCurrentUser, rankByPriority } from "@/lib/data/tasks";
import { requireCurrentUser } from "@/lib/data/current-user";
import { TaskCard } from "@/components/task-card";
import { getMotivationalMessage } from "@/lib/motivation";

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const tasks = await listTasksForCurrentUser();
  const pending = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");
  const ranked = rankByPriority(pending);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const overdue = pending.filter((t) => t.dueAt && new Date(t.dueAt) < now);
  const today = pending.filter((t) => t.dueAt && isSameDay(new Date(t.dueAt), now));
  const tomorrowTasks = pending.filter((t) => t.dueAt && isSameDay(new Date(t.dueAt), tomorrow));
  const topRecommendation = ranked[0];

  const completedThisWeek = tasks.filter((t) => {
    if (t.status !== "COMPLETED" && t.status !== "SUBMITTED") return false;
    const updated = new Date(t.updatedAt);
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return updated >= weekAgo;
  }).length;

  const lastActivity = tasks.reduce<Date | null>((latest, t) => {
    const updated = new Date(t.updatedAt);
    return !latest || updated > latest ? updated : latest;
  }, null);
  const daysSinceLastActive = lastActivity
    ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
    : undefined;
  const motivation = getMotivationalMessage({ daysSinceLastActive });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">¡Hola, {user.name ?? "de nuevo"}! 👋</h1>
        <p className="text-foreground/60">¿Qué debo hacer hoy?</p>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <span className="text-2xl">{motivation.emoji}</span>
        <p className="text-sm text-foreground/80">{motivation.text}</p>
      </div>

      {topRecommendation && (
        <div className="brand-gradient rounded-2xl p-6 text-white">
          <p className="mb-1 text-sm font-medium opacity-90">Recomendación IA</p>
          <p className="text-lg font-semibold">{topRecommendation.title}</p>
          <p className="mt-1 text-sm opacity-90">
            {topRecommendation.subjectName ?? "Sin asignatura"} · Prioridad {Math.round(topRecommendation.priorityScore ?? 0)}
          </p>
          <Link
            href="/study"
            className="mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/25"
          >
            Comenzar sesión de estudio
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Vencidas" value={overdue.length} tone="urgent" />
        <StatCard label="Hoy" value={today.length} tone="warning" />
        <StatCard label="Completadas esta semana" value={completedThisWeek} tone="success" />
      </div>

      <Section title="Urgente" tasks={overdue} emptyText="No tienes tareas vencidas." />
      <Section title="Hoy" tasks={today} emptyText="Nada para hoy." />
      <Section title="Mañana" tasks={tomorrowTasks} emptyText="Nada para mañana todavía." />
      <Section title="Todas las pendientes" tasks={ranked} emptyText="No tienes tareas pendientes." />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "urgent" | "warning" | "success" }) {
  const color = { urgent: "text-brand-urgent", warning: "text-brand-warning", success: "text-brand-success" }[tone];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-foreground/60">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Section({
  title,
  tasks,
  emptyText,
}: {
  title: string;
  tasks: Awaited<ReturnType<typeof listTasksForCurrentUser>>;
  emptyText: string;
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/50">{title}</h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-foreground/50">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}
