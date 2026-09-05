import { notFound } from "next/navigation";
import { getMaterialDetail } from "@/lib/data/materials";
import { GenerateSummaryButton } from "./generate-summary-button";

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await getMaterialDetail(id);
  if (!material) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{material.title}</h1>
        <p className="text-foreground/60">
          {material.subjectName ?? "Sin asignatura"} · {new Date(material.createdAt).toLocaleDateString("es-CL")}
        </p>
      </div>

      <GenerateSummaryButton materialId={material.id} status={material.extractedTextStatus} />

      {material.summaries.length === 0 ? (
        <p className="text-sm text-foreground/50">Todavía no hay un resumen generado para este material.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {material.summaries.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-5">
              <p className="mb-2 text-xs font-medium text-foreground/50">
                Resumen IA · {new Date(s.createdAt).toLocaleString("es-CL")}
              </p>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{s.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
