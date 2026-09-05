import { createAdminClient } from "@/lib/supabase/admin";

export default async function AiUsagePage() {
  const admin = createAdminClient();
  const { data: usage } = await admin
    .from("ai_usage")
    .select("feature, provider, model, input_tokens, output_tokens, estimated_cost_usd")
    .order("created_at", { ascending: false })
    .limit(2000);

  const byFeature = new Map<string, { calls: number; tokens: number; cost: number }>();
  for (const row of usage ?? []) {
    const entry = byFeature.get(row.feature) ?? { calls: 0, tokens: 0, cost: 0 };
    entry.calls += 1;
    entry.tokens += row.input_tokens + row.output_tokens;
    entry.cost += Number(row.estimated_cost_usd);
    byFeature.set(row.feature, entry);
  }

  const totalCost = [...byFeature.values()].reduce((s, e) => s + e.cost, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Uso de IA</h1>
        <p className="text-foreground/60">Costo total (últimas 2000 llamadas): ${totalCost.toFixed(2)}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Función</th>
              <th className="px-4 py-3 font-medium">Llamadas</th>
              <th className="px-4 py-3 font-medium">Tokens</th>
              <th className="px-4 py-3 font-medium">Costo estimado</th>
            </tr>
          </thead>
          <tbody>
            {[...byFeature.entries()].map(([feature, e]) => (
              <tr key={feature} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{feature}</td>
                <td className="px-4 py-3">{e.calls}</td>
                <td className="px-4 py-3">{e.tokens.toLocaleString()}</td>
                <td className="px-4 py-3">${e.cost.toFixed(4)}</td>
              </tr>
            ))}
            {byFeature.size === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-foreground/40">
                  Aún no hay uso de IA registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
