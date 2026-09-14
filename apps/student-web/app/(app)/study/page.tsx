import { listTasksForCurrentUser } from "@/lib/data/tasks";
import { requireCurrentUser } from "@/lib/data/current-user";
import { StudyClient } from "./study-client";
import type { AiProvider } from "@/lib/ai-study-prompt";

export default async function StudyPage() {
  const [tasks, user] = await Promise.all([listTasksForCurrentUser(), requireCurrentUser()]);
  const actionable = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">¿Cuánto tiempo tienes?</h1>
      <p className="mb-6 text-foreground/60">Te digo lo mejor que puedes hacer ahora.</p>
      <StudyClient tasks={actionable} initialProvider={user.preferredAiProvider as AiProvider | null} />
    </div>
  );
}
