import Link from "next/link";
import { requireStaff } from "@/lib/data/current-staff";
import { logout } from "@/lib/actions/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Usuarios" },
  { href: "/institutions", label: "Instituciones" },
  { href: "/subscriptions", label: "Suscripciones" },
  { href: "/licenses", label: "Licencias" },
  { href: "/ai-usage", label: "Uso de IA" },
  { href: "/analytics", label: "Analíticas" },
  { href: "/feature-flags", label: "Feature Flags" },
  { href: "/audit", label: "Auditoría" },
  { href: "/settings", label: "Configuración" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card px-4 py-6 sm:flex">
        <Link href="/dashboard" className="mb-8 text-lg font-semibold tracking-tight">
          StudyFlow <span className="brand-gradient-text">Admin</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-foreground/70 hover:bg-background hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-border pt-4 text-xs text-foreground/50">
          <p>{staff.name ?? staff.email}</p>
          <p className="mt-1">{staff.isOwner ? "OWNER" : staff.roles.join(", ")}</p>
          <form action={logout} className="mt-3">
            <button type="submit" className="text-foreground/50 hover:text-foreground">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 sm:px-10">{children}</main>
    </div>
  );
}
