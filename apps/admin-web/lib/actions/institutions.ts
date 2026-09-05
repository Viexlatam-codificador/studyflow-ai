"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createInstitution(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("El nombre es obligatorio.");
  const isPilot = formData.get("is_pilot") === "on";

  const { error } = await supabase.from("institutions").insert({ name, slug: slugify(name), is_pilot: isPilot });
  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "institution_created",
    target_type: "institution",
    metadata: { name, is_pilot: isPilot },
  });

  revalidatePath("/institutions");
}
