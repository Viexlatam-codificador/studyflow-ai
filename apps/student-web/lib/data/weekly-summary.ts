import type { TaskWithSubject } from "@/lib/data/tasks";

export interface WeeklyAlert {
  task: TaskWithSubject;
  label: string;
  tone: "urgent" | "warning" | "info";
}

/** Same thresholds as `notification_type` in
 * supabase/migrations/0007_notifications.sql, applied here for the in-app
 * weekly view. Push/email delivery for these still needs a scheduled job
 * (Vercel Cron / Supabase Edge Function) — not implemented yet, this is the
 * "look at it when you open the app" version. */
export function computeWeeklyAlerts(tasks: TaskWithSubject[], now: Date = new Date()): WeeklyAlert[] {
  const alerts: WeeklyAlert[] = [];

  for (const task of tasks) {
    if (!task.dueAt) continue;
    if (task.status === "COMPLETED" || task.status === "SUBMITTED") continue;

    const dueAt = new Date(task.dueAt);
    const hoursRemaining = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining < 0) {
      alerts.push({ task, label: "Vencida", tone: "urgent" });
    } else if (hoursRemaining <= 1) {
      alerts.push({ task, label: "Vence en menos de 1 hora", tone: "urgent" });
    } else if (hoursRemaining <= 6 && (task.priorityScore ?? 0) >= 70) {
      alerts.push({ task, label: "Alta prioridad — vence en menos de 6 horas", tone: "urgent" });
    } else if (hoursRemaining <= 24) {
      alerts.push({ task, label: "Vence mañana", tone: "warning" });
    } else if (hoursRemaining <= 24 * 3) {
      alerts.push({ task, label: "Vence en 3 días", tone: "warning" });
    } else if (hoursRemaining <= 24 * 5) {
      alerts.push({ task, label: "Vence en 5 días", tone: "info" });
    } else if (hoursRemaining <= 24 * 7) {
      alerts.push({ task, label: "Vence esta semana", tone: "info" });
    }
  }

  const toneRank: Record<WeeklyAlert["tone"], number> = { urgent: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);
}

export function tasksThisWeek(tasks: TaskWithSubject[], now: Date = new Date()): TaskWithSubject[] {
  const weekFromNow = new Date(now);
  weekFromNow.setDate(now.getDate() + 7);
  return tasks.filter((t) => t.dueAt && new Date(t.dueAt) <= weekFromNow);
}
