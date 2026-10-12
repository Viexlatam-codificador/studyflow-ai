import Link from "next/link";
import { listTasksForCurrentUser } from "@/lib/data/tasks";
import { requireCurrentUser } from "@/lib/data/current-user";
import type { AiProvider } from "@/lib/ai-study-prompt";
import { GeminiFlow } from "./gemini-flow";

export default async function GeminiPersonalizePage() {
  const [tasks, user] = await Promise.all([listTasksForCurrentUser(), requireCurrentUser()]);
  const actionable = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/study" className="text-sm text-foreground/50 hover:text-foreground">
          ← Volver a Estudiar
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Personalizar con mi IA</h1>
        <p className="text-foreground/60">
          Elige ChatGPT o Gemini, copia un contexto seguro y trae su propuesta de vuelta. StudyFlow nunca pide
          tu contraseña ni accede a la sesión de tu proveedor.
        </p>
      </div>

      <GeminiFlow
        tasks={actionable.map((t) => ({ id: t.id, title: t.title, subjectName: t.subjectName, dueAt: t.dueAt }))}
        initialProvider={((user.preferredAiProvider as AiProvider | null) ?? "chatgpt") === "gemini" ? "gemini" : "chatgpt"}
      />
    </div>
  );
}
