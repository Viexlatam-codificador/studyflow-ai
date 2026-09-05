import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  planKey: string;
  activeSubscriptionId: string | null;
  createdAt: string;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: roles }, { data: entitlements }, { data: subscriptions }] =
    await Promise.all([
      admin.from("profiles").select("id, email, name, created_at").order("created_at", { ascending: false }).limit(200),
      admin.from("user_roles").select("user_id, role"),
      admin.from("entitlements").select("user_id, plan_key"),
      admin.from("subscriptions").select("id, user_id, status").eq("status", "ACTIVE"),
    ]);

  const rolesByUser = new Map<string, string[]>();
  for (const r of roles ?? []) rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);

  const planByUser = new Map<string, string>();
  for (const e of entitlements ?? []) planByUser.set(e.user_id, e.plan_key);

  const activeSubByUser = new Map<string, string>();
  for (const s of subscriptions ?? []) activeSubByUser.set(s.user_id, s.id);

  return (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    roles: rolesByUser.get(p.id) ?? [],
    planKey: planByUser.get(p.id) ?? "FREE",
    activeSubscriptionId: activeSubByUser.get(p.id) ?? null,
    createdAt: p.created_at,
  }));
}
