import { createClient } from "@/lib/supabase/server";
import { InboxClient } from "./inbox-client";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subjects } = await supabase
    .from("subject_members")
    .select("subjects(id, name)")
    .eq("user_id", user?.id ?? "");

  const subjectOptions = (subjects ?? [])
    .flatMap((s) => (Array.isArray(s.subjects) ? s.subjects : s.subjects ? [s.subjects] : []))
    .filter((s): s is { id: string; name: string } => Boolean(s));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">StudyFlow Inbox</h1>
      <p className="mb-6 text-foreground/60">
        Cuéntame qué tienes que hacer — te muestro la tarea detectada antes de guardarla.
      </p>
      <InboxClient subjects={subjectOptions} userId={user?.id ?? ""} />
    </div>
  );
}
