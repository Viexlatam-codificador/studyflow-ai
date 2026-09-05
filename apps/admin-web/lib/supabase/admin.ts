import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * service_role client — bypasses RLS. Only for deliberate, staff-triggered
 * privileged operations (granting licenses, editing feature flags scope
 * rows, etc.) — always log to audit_logs when using this.
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
