import Link from "next/link";
import { requireCurrentUser } from "@/lib/data/current-user";
import { logout } from "@/lib/actions/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Hoy" },
  { href: "/calendar", label: "Semana" },
  { href: "/tasks", label: "Tareas" },
  { href: "/materials", label: "Materiales" },
  { href: "/study", label: "Estudiar" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();

  return (
    <div className="flex min-h-screen flex-col pb-20 sm:pb-0">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-8">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          StudyFlow <span className="brand-gradient-text">AI</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <nav className="hidden gap-4 sm:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="text-foreground/70 hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="hidden text-foreground/50 sm:inline">{user.name ?? user.email}</span>
          <form action={logout}>
            <button type="submit" className="text-foreground/50 hover:text-foreground">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>

      <Link
        href="/inbox"
        className="brand-gradient fixed bottom-20 right-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-semibold text-white shadow-lg sm:bottom-8"
        aria-label="Agregar a StudyFlow"
      >
        +
      </Link>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-background/95 py-2 backdrop-blur sm:hidden">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className="px-3 py-2 text-xs text-foreground/70">
            {item.label}
          </Link>
        ))}
        <Link href="/inbox" className="px-3 py-2 text-xs text-foreground/70">
          IA
        </Link>
      </nav>
    </div>
  );
}
