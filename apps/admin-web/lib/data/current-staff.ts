import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentStaff {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  isOwner: boolean;
}

export async function requireStaff(): Promise<CurrentStaff> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roleList = (roles ?? []).map((r) => r.role);
  if (roleList.length === 0) redirect("/unauthorized");

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.name ?? null,
    roles: roleList,
    isOwner: roleList.includes("OWNER"),
  };
}
