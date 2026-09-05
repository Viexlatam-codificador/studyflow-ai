import { listTasksForCurrentUser } from "@/lib/data/tasks";
import { createClient } from "@/lib/supabase/server";
import { NewTaskForm } from "./new-task-form";
import { TaskListSortable } from "./task-list-sortable";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: subjects }, tasks] = await Promise.all([
    supabase.from("subject_members").select("subjects(id, name)").eq("user_id", user?.id ?? ""),
    listTasksForCurrentUser(),
  ]);

  const subjectOptions = (subjects ?? [])
    .flatMap((s) => (Array.isArray(s.subjects) ? s.subjects : s.subjects ? [s.subjects] : []))
    .filter((s): s is { id: string; name: string } => Boolean(s));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Tareas</h1>
        <p className="text-foreground/60">
          Ordénalas como quieras: automático por prioridad, o arrastra según tu propio calendario.
        </p>
      </div>

      <NewTaskForm subjects={subjectOptions} />

      <TaskListSortable tasks={tasks} />
    </div>
  );
}
