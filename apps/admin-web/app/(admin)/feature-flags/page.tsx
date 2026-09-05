import { createClient } from "@/lib/supabase/server";
import { toggleFeatureFlag } from "@/lib/actions/feature-flags";

export default async function FeatureFlagsPage() {
  const supabase = await createClient();
  const { data: flags } = await supabase.from("feature_flags").select("*").order("key");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Feature Flags</h1>
        <p className="text-foreground/60">Control global. Scopes por institución/usuario/plan vía Supabase.</p>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
        {(flags ?? []).map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{f.key}</p>
              <p className="text-sm text-foreground/60">{f.description}</p>
            </div>
            <form action={toggleFeatureFlag}>
              <input type="hidden" name="flag_id" value={f.id} />
              <input type="hidden" name="next_enabled" value={(!f.enabled_globally).toString()} />
              <button
                type="submit"
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  f.enabled_globally ? "brand-gradient text-white" : "border border-border text-foreground/60"
                }`}
              >
                {f.enabled_globally ? "Activado" : "Desactivado"}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
