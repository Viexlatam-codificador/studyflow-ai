import { createAdminClient } from "@/lib/supabase/admin";

export interface FounderMetrics {
  totalUsers: number;
  dau: number;
  wau: number;
  mau: number;
  planCounts: Record<string, number>;
  mrrUsd: number;
  aiTokens: { input: number; output: number };
  aiCostUsd: number;
  tasksCreated: number;
  tasksCompleted: number;
  studySessions: number;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** Aggregate metrics for the Founder dashboard — runs with the service_role
 * client because it reads across all users; only reachable from a
 * staff-gated /admin route (see proxy.ts + requireStaff()). */
export async function getFounderMetrics(): Promise<FounderMetrics> {
  const supabase = createAdminClient();

  const [
    { count: totalUsers },
    { data: dauEvents },
    { data: wauEvents },
    { data: mauEvents },
    { data: entitlements },
    { data: subscriptions },
    { data: aiUsage },
    { count: tasksCreated },
    { count: tasksCompleted },
    { count: studySessions },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("usage_events").select("user_id").gte("created_at", daysAgo(1)),
    supabase.from("usage_events").select("user_id").gte("created_at", daysAgo(7)),
    supabase.from("usage_events").select("user_id").gte("created_at", daysAgo(30)),
    supabase.from("entitlements").select("plan_key"),
    supabase
      .from("subscriptions")
      .select("plans(price_monthly_usd)")
      .eq("status", "ACTIVE")
      .eq("source", "MONTHLY"),
    supabase.from("ai_usage").select("input_tokens, output_tokens, estimated_cost_usd"),
    supabase.from("tasks").select("*", { count: "exact", head: true }),
    supabase.from("tasks").select("*", { count: "exact", head: true }).in("status", ["COMPLETED", "SUBMITTED"]),
    supabase.from("study_sessions").select("*", { count: "exact", head: true }),
  ]);

  const planCounts: Record<string, number> = { FREE: 0, PRO: 0, CAMPUS: 0 };
  for (const e of entitlements ?? []) {
    planCounts[e.plan_key] = (planCounts[e.plan_key] ?? 0) + 1;
  }

  const mrrUsd = (subscriptions ?? []).reduce((sum, s) => {
    const plan = Array.isArray(s.plans) ? s.plans[0] : s.plans;
    return sum + Number(plan?.price_monthly_usd ?? 0);
  }, 0);

  const aiTokens = (aiUsage ?? []).reduce(
    (acc, row) => ({ input: acc.input + row.input_tokens, output: acc.output + row.output_tokens }),
    { input: 0, output: 0 }
  );
  const aiCostUsd = (aiUsage ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0);

  const distinctUsers = (rows: { user_id: string | null }[] | null) =>
    new Set((rows ?? []).map((r) => r.user_id).filter(Boolean)).size;

  return {
    totalUsers: totalUsers ?? 0,
    dau: distinctUsers(dauEvents),
    wau: distinctUsers(wauEvents),
    mau: distinctUsers(mauEvents),
    planCounts,
    mrrUsd,
    aiTokens,
    aiCostUsd,
    tasksCreated: tasksCreated ?? 0,
    tasksCompleted: tasksCompleted ?? 0,
    studySessions: studySessions ?? 0,
  };
}
