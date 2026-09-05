"use client";

import { useState, useTransition } from "react";
import { generateMaterialSummary } from "@/lib/actions/materials";

export function GenerateSummaryButton({ materialId, status }: { materialId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              await generateMaterialSummary(materialId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error generando el resumen.");
            }
          })
        }
        disabled={isPending || status === "PROCESSING"}
        className="brand-gradient rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isPending || status === "PROCESSING" ? "Generando resumen…" : "Generar resumen con IA"}
      </button>
      {error && <p className="mt-2 text-sm text-brand-urgent">{error}</p>}
    </div>
  );
}
