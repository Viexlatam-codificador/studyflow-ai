import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth/callback"];

/**
 * Refreshes the Supabase session on every request (Next.js 16 renamed
 * "Middleware" to "Proxy" — see docs/architecture/next16-notes.md) and
 * redirects unauthenticated users away from the app shell. This is an
 * optimistic check only — real authorization still happens via RLS and
 * server-side checks, never trust this alone (see Next.js auth guide).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  // /api/* routes handle their own auth (session cookie or a bearer-style
  // token, e.g. the calendar .ics feed) — calendar apps polling that feed
  // never carry a Supabase session cookie, so this proxy must not gate them.
  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/api/");

  if (!user && !isPublic) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
