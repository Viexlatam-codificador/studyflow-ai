import { listTasksForCurrentUser } from "@/lib/data/tasks";
import { StudyClient } from "./study-client";

export default async function StudyPage() {
  const tasks = await listTasksForCurrentUser();
  const actionable = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">¿Cuánto tiempo tienes?</h1>
      <p className="mb-6 text-foreground/60">Te digo lo mejor que puedes hacer ahora.</p>
      <StudyClient tasks={actionable} />
    </div>
  );
}
