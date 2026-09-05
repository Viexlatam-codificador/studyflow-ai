import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createInstitution } from "@/lib/actions/institutions";

export default async function InstitutionsPage() {
  const supabase = await createClient();
  const { data: institutions } = await supabase
    .from("institutions")
    .select("id, name, slug, is_pilot, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Instituciones</h1>
        <p className="text-foreground/60">
          StudyFlow es multi-institución por diseño — nada está hardcodeado a una sola institución.
        </p>
      </div>

      <form action={createInstitution} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nombre</span>
          <input
            name="name"
            required
            placeholder="Ej: Universidad Demo"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_pilot" />
          Es piloto
        </label>
        <button type="submit" className="brand-gradient rounded-full px-4 py-2 text-sm font-medium text-white">
          Crear institución
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-foreground/50">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Piloto</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(institutions ?? []).map((i) => (
              <tr key={i.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{i.name}</td>
                <td className="px-4 py-3 text-foreground/50">{i.slug}</td>
                <td className="px-4 py-3">{i.is_pilot ? "Sí" : "No"}</td>
                <td className="px-4 py-3">
                  <Link href={`/institutions/${i.id}`} className="text-brand-violet hover:underline">
                    Gestionar →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
