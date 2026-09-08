import Link from "next/link";
import { notFound } from "next/navigation";
import { getTaskDetail } from "@/lib/data/task-detail";
import { CollaborationPanel } from "./collaboration-panel";
import { formatShortDate } from "@/lib/format-date";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskDetail(id);
  if (!task) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/tasks" className="text-sm text-foreground/50 hover:text-foreground">
        ← Volver a tareas
      </Link>

      <div>
        <div className="flex items-center gap-2">
          {task.subjectColor && (
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: task.subjectColor }} />
          )}
          <span className="text-sm text-foreground/60">{task.subjectName ?? "Sin asignatura"}</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{task.title}</h1>
        {task.description && <p className="mt-2 text-sm text-foreground/70">{task.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/50">
          {task.dueAt && <span>Vence: {formatShortDate(new Date(task.dueAt))}</span>}
          {task.gradeWeight ? <span>Vale {task.gradeWeight}%</span> : null}
          <span>Prioridad: {Math.round(task.priorityScore ?? 0)}</span>
        </div>
      </div>

      <CollaborationPanel
        taskId={task.id}
        isOwner={task.isOwner}
        collaborators={task.collaborators}
        collaborativeDocUrl={task.collaborativeDocUrl}
      />
    </div>
  );
}
