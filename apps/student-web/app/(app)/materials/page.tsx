import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listMaterialsForCurrentUser, listSharedMaterialsForCurrentUser } from "@/lib/data/materials";
import { requireCurrentUser } from "@/lib/data/current-user";
import { UploadForm } from "./upload-form";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Sin resumen",
  PROCESSING: "Generando resumen…",
  READY: "Resumen listo",
  FAILED: "Error al generar resumen",
};

export default async function MaterialsPage() {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const [materials, sharedMaterials, { data: subjects }] = await Promise.all([
    listMaterialsForCurrentUser(),
    listSharedMaterialsForCurrentUser(),
    supabase.from("subject_members").select("subjects(id, name)").eq("user_id", user.id),
  ]);

  const subjectOptions = (subjects ?? [])
    .flatMap((s) => (Array.isArray(s.subjects) ? s.subjects : s.subjects ? [s.subjects] : []))
    .filter((s): s is { id: string; name: string } => Boolean(s));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Materiales</h1>
        <p className="text-foreground/60">
          Sube tus apuntes (PDF, TXT, Markdown), genera un resumen con IA, y compártelos con tu asignatura.
        </p>
      </div>

      <UploadForm userId={user.id} subjects={subjectOptions} />

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground/50">Tus materiales</h2>
        <div className="flex flex-col gap-2">
          {materials.length === 0 ? (
            <p className="text-sm text-foreground/50">Aún no has subido materiales.</p>
          ) : (
            materials.map((m) => (
              <Link
                key={m.id}
                href={`/materials/${m.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-brand-violet"
              >
                <div>
                  <p className="font-medium">
                    {m.title} {m.visibility === "SUBJECT" && <span className="text-xs text-brand-success">· compartido</span>}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {m.subjectName ?? "Sin asignatura"} · {new Date(m.createdAt).toLocaleDateString("es-CL")}
                  </p>
                </div>
                <span className="text-xs text-foreground/50">{STATUS_LABELS[m.extractedTextStatus] ?? m.extractedTextStatus}</span>
              </Link>
            ))
          )}
        </div>
      </div>

      {sharedMaterials.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground/50">
            Compartidos por tus compañeros
          </h2>
          <div className="flex flex-col gap-2">
            {sharedMaterials.map((m) => (
              <Link
                key={m.id}
                href={`/materials/${m.id}`}
                className="flex items-center justify-between rounded-xl border border-brand-success/30 bg-brand-success/5 p-4 hover:border-brand-success"
              >
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-foreground/50">
                    {m.subjectName} · subido por {m.uploaderName ?? "un compañero"}
                  </p>
                </div>
                <span className="text-xs text-foreground/50">{STATUS_LABELS[m.extractedTextStatus] ?? m.extractedTextStatus}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
