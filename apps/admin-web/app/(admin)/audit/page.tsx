import { createAdminClient } from "@/lib/supabase/admin";

export default async function AuditPage() {
  const admin = createAdminClient();
  const { data: logs } = await admin
    .from("audit_logs")
    .select("id, action, target_type, target_id, metadata, created_at, profiles(email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Auditoría</h1>
        <p className="text-foreground/60">Últimas 200 acciones administrativas.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Cuándo</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Acción</th>
              <th className="px-4 py-3 font-medium">Objetivo</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log) => {
              const actor = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
              return (
                <tr key={log.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3 text-foreground/50">{new Date(log.created_at).toLocaleString("es-CL")}</td>
                  <td className="px-4 py-3">{actor?.email ?? "sistema"}</td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3 text-foreground/50">
                    {log.target_type}
                    {log.target_id ? ` (${log.target_id.slice(0, 8)}…)` : ""}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground/50">
                    {JSON.stringify(log.metadata)}
                  </td>
                </tr>
              );
            })}
            {(logs ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-foreground/40">
                  Aún no hay eventos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
