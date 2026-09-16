"use client";

import { useTransition } from "react";
import { setSubjectConfidence, deleteSubjectConfidence } from "@/lib/actions/study-profile";
import type { SubjectConfidenceRow } from "@/lib/data/study-profile";

export function ConfidenceList({ subjects }: { subjects: SubjectConfidenceRow[] }) {
  const [isPending, startTransition] = useTransition();

  if (subjects.length === 0) {
    return <p className="text-sm text-foreground/50">Aún no estás inscrito en ninguna asignatura.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {subjects.map((s) => (
        <div key={s.subjectId} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{s.subjectName}</p>
            <p className="text-xs text-foreground/50">
              {s.reportedSessionCount > 0
                ? `Reportado en sesiones: ${s.reportedAverage}/5 (${s.reportedSessionCount} sesiones)`
                : "Evidencia todavía insuficiente por sesiones — aún no reportas comprensión aquí."}
            </p>
          </div>

          <form
            action={(formData) => startTransition(() => setSubjectConfidence(formData))}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="subject_id" value={s.subjectId} />
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border text-xs ${
                    s.declaredConfidence === n ? "brand-gradient border-transparent text-white" : "border-border"
                  }`}
                >
                  <input type="radio" name="confidence" value={n} defaultChecked={s.declaredConfidence === n} className="hidden" />
                  {n}
                </label>
              ))}
            </div>
            <button type="submit" disabled={isPending} className="text-xs font-medium text-brand-violet hover:underline disabled:opacity-60">
              Guardar
            </button>
            {s.declaredConfidence !== null && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("subject_id", s.subjectId);
                  startTransition(() => deleteSubjectConfidence(fd));
                }}
                className="text-xs text-foreground/40 hover:text-brand-urgent disabled:opacity-60"
              >
                Borrar
              </button>
            )}
          </form>
        </div>
      ))}
    </div>
  );
}
