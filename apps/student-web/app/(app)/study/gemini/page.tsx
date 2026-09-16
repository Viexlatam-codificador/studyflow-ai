import Link from "next/link";
import { listTasksForCurrentUser } from "@/lib/data/tasks";
import { GeminiFlow } from "./gemini-flow";

export default async function GeminiPersonalizePage() {
  const tasks = await listTasksForCurrentUser();
  const actionable = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/study" className="text-sm text-foreground/50 hover:text-foreground">
          ← Volver a Estudiar
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Personalizar con mi Gemini</h1>
        <p className="text-foreground/60">
          StudyFlow no se conecta a Gemini por ti. Copias un contexto, lo pegas en tu propia cuenta de Gemini, y
          traes su respuesta de vuelta aquí — nunca pedimos tu contraseña ni tu sesión de Google.
        </p>
      </div>

      <GeminiFlow tasks={actionable.map((t) => ({ id: t.id, title: t.title, subjectName: t.subjectName, dueAt: t.dueAt }))} />
    </div>
  );
}
