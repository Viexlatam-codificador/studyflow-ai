import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role client — bypasses RLS entirely. Only import this from
 * server actions / route handlers that perform a deliberate privileged
 * operation (e.g. owner bootstrap, admin-triggered license grants).
 * The `server-only` import makes accidentally bundling this into client
 * code a build error instead of a leaked secret.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL are not configured.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
