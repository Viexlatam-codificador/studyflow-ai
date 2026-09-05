import { createAdminClient } from "@/lib/supabase/admin";
import { buildIcsFeed } from "@/lib/ics";

/**
 * Public, unauthenticated-by-session endpoint — calendar apps (Google,
 * Apple, Outlook) poll this on their own schedule and can't hold a
 * StudyFlow login session. The random `token` (profiles.calendar_feed_token)
 * is the credential instead: unguessable, scoped to one user's read-only
 * task list, and regeneratable from /calendar if it ever leaks.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("calendar_feed_token", token).maybeSingle();

  if (!profile) {
    return new Response("Not found", { status: 404 });
  }

  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, description, due_at")
    .eq("user_id", profile.id)
    .not("due_at", "is", null)
    .not("status", "in", "(COMPLETED,SUBMITTED)");

  const ics = buildIcsFeed(
    (tasks ?? []).map((t) => ({
      uid: t.id,
      title: t.title,
      description: t.description,
      dueAt: t.due_at as string,
    }))
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="studyflow.ics"',
      "Cache-Control": "public, max-age=1800",
    },
  });
}
