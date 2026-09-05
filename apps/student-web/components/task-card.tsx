"use client";

import { useTransition } from "react";
import { updateTaskStatus, deleteTask } from "@/lib/actions/tasks";
import type { TaskWithSubject } from "@/lib/data/tasks";
import { formatShortDate } from "@/lib/format-date";

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nueva",
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  REVIEW: "En revisión",
  COMPLETED: "Completada",
  SUBMITTED: "Entregada",
  OVERDUE: "Vencida",
};

function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return "Sin fecha";
  return formatShortDate(new Date(dueAt));
}

export function TaskCard({ task }: { task: TaskWithSubject }) {
  const [isPending, startTransition] = useTransition();
  const isDone = task.status === "COMPLETED" || task.status === "SUBMITTED";

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <button
        onClick={() =>
          startTransition(() => updateTaskStatus(task.id, isDone ? "IN_PROGRESS" : "COMPLETED"))
        }
        disabled={isPending}
        aria-label={isDone ? "Marcar como pendiente" : "Marcar como completada"}
        className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 ${
          isDone ? "border-brand-success bg-brand-success" : "border-foreground/30"
        }`}
      />

      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`font-medium ${isDone ? "text-foreground/50 line-through" : ""}`}>{task.title}</p>
          {task.priorityScore !== null && !isDone && (
            <span className="shrink-0 rounded-full bg-brand-violet/10 px-2 py-0.5 text-xs font-medium text-brand-violet">
              {Math.round(task.priorityScore)}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/60">
          {task.subjectName && <span>{task.subjectName}</span>}
          <span>{formatDueDate(task.dueAt)}</span>
          <span>{STATUS_LABELS[task.status] ?? task.status}</span>
          {task.gradeWeight ? <span>Vale {task.gradeWeight}%</span> : null}
        </div>
      </div>

      <button
        onClick={() => startTransition(() => deleteTask(task.id))}
        disabled={isPending}
        aria-label="Eliminar tarea"
        className="text-foreground/30 hover:text-brand-urgent"
      >
        ×
      </button>
    </div>
  );
}
