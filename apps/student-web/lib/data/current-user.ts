import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  planKey: string;
  onboardingCompletedAt: string | null;
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: roles }, { data: entitlement }] = await Promise.all([
    supabase.from("profiles").select("name, onboarding_completed_at").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("entitlements").select("plan_key").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.name ?? null,
    roles: (roles ?? []).map((r) => r.role),
    planKey: entitlement?.plan_key ?? "FREE",
    onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
  };
}
