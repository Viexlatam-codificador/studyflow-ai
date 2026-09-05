import { createAdminClient } from "@/lib/supabase/admin";

export default async function SubscriptionsPage() {
  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select("id, status, source, current_period_end, created_at, profiles(email), plans(key)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Suscripciones</h1>
        <p className="text-foreground/60">Últimas 100 suscripciones, todas las fuentes.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Fuente</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Vence</th>
            </tr>
          </thead>
          <tbody>
            {(subscriptions ?? []).map((s) => {
              const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
              const plan = Array.isArray(s.plans) ? s.plans[0] : s.plans;
              return (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{profile?.email ?? "—"}</td>
                  <td className="px-4 py-3">{plan?.key ?? "—"}</td>
                  <td className="px-4 py-3">{s.source}</td>
                  <td className="px-4 py-3">{s.status}</td>
                  <td className="px-4 py-3 text-foreground/50">
                    {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("es-CL") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
