import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/data/current-staff";
import { updatePlatformConfig } from "@/lib/actions/settings";

export default async function SettingsPage() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data: config } = await supabase.from("platform_config").select("key, value, updated_at");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-foreground/60">Ajustes a nivel de plataforma. Solo OWNER puede modificar.</p>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
        {(config ?? []).map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-mono text-sm font-medium">{c.key}</p>
              <p className="text-xs text-foreground/50">
                Actualizado: {new Date(c.updated_at).toLocaleString("es-CL")}
              </p>
            </div>
            {staff.isOwner ? (
              <form action={updatePlatformConfig} className="flex items-center gap-2">
                <input type="hidden" name="key" value={c.key} />
                <input
                  name="value"
                  defaultValue={c.value}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                />
                <button type="submit" className="text-sm font-medium text-brand-violet hover:underline">
                  Guardar
                </button>
              </form>
            ) : (
              <span className="text-sm text-foreground/60">{c.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
