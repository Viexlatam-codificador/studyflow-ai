"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleFeatureFlag(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const flagId = formData.get("flag_id") as string;
  const nextEnabled = formData.get("next_enabled") === "true";

  const { error } = await supabase.from("feature_flags").update({ enabled_globally: nextEnabled }).eq("id", flagId);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "feature_flag_changed",
    target_type: "feature_flag",
    target_id: flagId,
    metadata: { enabled_globally: nextEnabled },
  });

  revalidatePath("/feature-flags");
}
