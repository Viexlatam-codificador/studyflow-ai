"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regeneratePlan } from "@/lib/actions/study-plan";

export function RegenerateButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await regeneratePlan();
            if (result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          })
        }
        className="brand-gradient rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isPending ? "Generando…" : "Regenerar plan de la semana"}
      </button>
      {error && <p className="mt-2 text-sm text-brand-urgent">{error}</p>}
    </div>
  );
}
