import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/unauthorized"];
const STAFF_ROLES = ["OWNER", "SUPER_ADMIN", "SUPPORT", "INSTITUTION_ADMIN"];

/** Next.js 16 renamed Middleware to Proxy. Gates every /admin/* route behind
 * a staff role — optimistic check only, RLS is the real authorization
 * boundary (see supabase/migrations/0002_identity_and_roles.sql). */
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
  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next");

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && !isPublic) {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isStaff = (roles ?? []).some((r) => STAFF_ROLES.includes(r.role));
    if (!isStaff) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
