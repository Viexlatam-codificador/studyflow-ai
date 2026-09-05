import { createAdminClient } from "@/lib/supabase/admin";

export default async function LicensesPage() {
  const admin = createAdminClient();
  const { data: licenses } = await admin
    .from("licenses")
    .select("id, seats_total, seats_used, status, valid_from, valid_until, institutions(name), plans(key)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Licencias institucionales</h1>
        <p className="text-foreground/60">Lotes de licencias por institución (Campus).</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Institución</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Cupos</th>
              <th className="px-4 py-3 font-medium">Vigencia</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(licenses ?? []).map((l) => {
              const institution = Array.isArray(l.institutions) ? l.institutions[0] : l.institutions;
              const plan = Array.isArray(l.plans) ? l.plans[0] : l.plans;
              return (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{institution?.name ?? "—"}</td>
                  <td className="px-4 py-3">{plan?.key ?? "—"}</td>
                  <td className="px-4 py-3">
                    {l.seats_used} / {l.seats_total}
                  </td>
                  <td className="px-4 py-3 text-foreground/50">
                    {l.valid_from ?? "—"} → {l.valid_until ?? "—"}
                  </td>
                  <td className="px-4 py-3">{l.status}</td>
                </tr>
              );
            })}
            {(licenses ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-foreground/40">
                  Aún no hay licencias institucionales creadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
