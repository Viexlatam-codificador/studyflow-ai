"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updatePlatformConfig(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const key = formData.get("key") as string;
  const value = (formData.get("value") as string)?.trim();
  if (!value) throw new Error("El valor no puede estar vacío.");

  const { error } = await supabase
    .from("platform_config")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "owner_action",
    target_type: "platform_config",
    target_id: key,
    metadata: { value },
  });

  revalidatePath("/settings");
}
