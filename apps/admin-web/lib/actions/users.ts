"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STAFF_ROLES = ["OWNER", "SUPER_ADMIN"];

/** Defense in depth: even though every /admin route is proxy-gated, billing
 * writes are critical enough (principle #12) to re-check the actor's role
 * at the data layer, in case this action is ever reached another way. */
async function assertStaffActor(actorId: string) {
  const supabase = await createClient();
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", actorId);
  if (!(roles ?? []).some((r) => STAFF_ROLES.includes(r.role))) {
    throw new Error("Not authorized to perform this action.");
  }
}

/**
 * Grants a user free access to a plan (COMPLIMENTARY/PILOT/SCHOLARSHIP).
 * Runs with the service_role client because writing `subscriptions` is
 * backend-only by RLS design, and logs to audit_logs (section 26).
 */
export async function grantComplimentaryAccess(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) throw new Error("Not authenticated.");
  await assertStaffActor(actor.id);

  const targetUserId = formData.get("user_id") as string;
  const planKey = formData.get("plan_key") as string;
  const source = (formData.get("source") as string) || "COMPLIMENTARY";

  const admin = createAdminClient();

  const { data: plan } = await admin.from("plans").select("id").eq("key", planKey).single();
  if (!plan) throw new Error(`Plan "${planKey}" not found.`);

  const { error } = await admin.from("subscriptions").insert({
    user_id: targetUserId,
    plan_id: plan.id,
    status: "ACTIVE",
    source,
    granted_by: actor.id,
  });
  if (error) throw new Error(error.message);

  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    action: "license_granted",
    target_type: "user",
    target_id: targetUserId,
    metadata: { plan_key: planKey, source },
  });

  revalidatePath("/users");
  revalidatePath("/dashboard");
}

export async function revokeAccess(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) throw new Error("Not authenticated.");
  await assertStaffActor(actor.id);

  const subscriptionId = formData.get("subscription_id") as string;
  const targetUserId = formData.get("user_id") as string;

  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions").update({ status: "CANCELED" }).eq("id", subscriptionId);
  if (error) throw new Error(error.message);

  await admin.from("audit_logs").insert({
    actor_id: actor.id,
    action: "license_revoked",
    target_type: "user",
    target_id: targetUserId,
    metadata: { subscription_id: subscriptionId },
  });

  revalidatePath("/users");
}
