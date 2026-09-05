import { listTasksForCurrentUser } from "@/lib/data/tasks";
import { computeWeeklyAlerts } from "@/lib/data/weekly-summary";
import { getWeeklyNarrative } from "@/lib/data/weekly-narrative";
import { requireCurrentUser } from "@/lib/data/current-user";
import { createClient } from "@/lib/supabase/server";
import { InteractiveCalendar } from "./interactive-calendar";
import { CalendarSyncPanel } from "./calendar-sync-panel";
import type { CalendarTheme } from "@/lib/calendar-themes";

const ALERT_TONE_CLASSES: Record<string, string> = {
  urgent: "border-brand-urgent/40 bg-brand-urgent/10 text-brand-urgent",
  warning: "border-brand-warning/40 bg-brand-warning/10 text-brand-warning",
  info: "border-border bg-card text-foreground/70",
};

export default async function CalendarPage() {
  const user = await requireCurrentUser();
  const supabase = await createClient();
  const tasks = await listTasksForCurrentUser();

  const [narrative, alerts, { data: profile }] = await Promise.all([
    getWeeklyNarrative(user.id, tasks),
    Promise.resolve(computeWeeklyAlerts(tasks)),
    supabase.from("profiles").select("calendar_theme").eq("id", user.id).single(),
  ]);

  const theme = (profile?.calendar_theme as CalendarTheme | null) ?? { preset: "aurora" };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Semana</h1>
        <p className="text-foreground/60">Resumen, alertas y tu calendario — arrastra para reorganizar.</p>
      </div>

      <div className="brand-gradient rounded-2xl p-6 text-white">
        <p className="mb-1 text-sm font-medium opacity-90">
          {narrative.aiGenerated ? "Resumen de la semana (IA)" : "Resumen de la semana"}
        </p>
        <p className="text-sm leading-relaxed">{narrative.text}</p>
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Alertas</h2>
          {alerts.map((a) => (
            <div
              key={a.task.id}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${ALERT_TONE_CLASSES[a.tone]}`}
            >
              <span>
                <span className="font-medium">{a.task.title}</span>
                {a.task.subjectName && <span className="opacity-70"> · {a.task.subjectName}</span>}
              </span>
              <span className="shrink-0 font-medium">{a.label}</span>
            </div>
          ))}
        </div>
      )}

      <InteractiveCalendar tasks={tasks} initialTheme={theme} />

      <CalendarSyncPanel />
    </div>
  );
}
