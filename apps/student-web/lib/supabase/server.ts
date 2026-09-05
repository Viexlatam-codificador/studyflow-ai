import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server-side Supabase client using the anon key — RLS still applies.
 * Never use the service_role key here; that belongs only in trusted
 * server-only code paths (see lib/supabase/admin.ts). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — safe to ignore because the
            // proxy (see proxy.ts) refreshes the session on every request.
          }
        },
      },
    }
  );
}
