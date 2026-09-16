import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listTasksForCurrentUser } from "@/lib/data/tasks";
import { requireCurrentUser } from "@/lib/data/current-user";
import { StudyClient } from "./study-client";
import type { AiProvider } from "@/lib/ai-study-prompt";

const HUB_LINKS = [
  { href: "/study/plan", label: "Mi plan semanal", emoji: "🗓️" },
  { href: "/study/profile", label: "Mi perfil de estudio", emoji: "🎯" },
  { href: "/study/availability", label: "Mi disponibilidad", emoji: "⏰" },
  { href: "/study/gemini", label: "Personalizar con mi Gemini", emoji: "✨" },
];

export default async function StudyPage() {
  const supabase = await createClient();
  const [tasks, user] = await Promise.all([listTasksForCurrentUser(), requireCurrentUser()]);
  const actionable = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "SUBMITTED");

  const { data: memberships } = await supabase.from("subject_members").select("subjects(id, name)").eq("user_id", user.id);
  const subjects = (memberships ?? [])
    .flatMap((m) => (Array.isArray(m.subjects) ? m.subjects : m.subjects ? [m.subjects] : []))
    .filter((s): s is { id: string; name: string } => Boolean(s));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">¿Cuánto tiempo tienes?</h1>
      <p className="mb-6 text-foreground/60">Te digo lo mejor que puedes hacer ahora.</p>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HUB_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 text-center text-xs font-medium hover:border-brand-violet"
          >
            <span className="text-lg">{l.emoji}</span>
            {l.label}
          </Link>
        ))}
      </div>

      <StudyClient tasks={actionable} initialProvider={user.preferredAiProvider as AiProvider | null} subjects={subjects} />
    </div>
  );
}
