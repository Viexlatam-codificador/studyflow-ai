"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buildGeminiExport,
  importGeminiProposal,
  applyGeminiProposal,
  dismissGeminiProposal,
  type BuildContextResult,
  type ImportProposalState,
} from "@/lib/actions/gemini-proposal";

const GEMINI_URL = "https://gemini.google.com/app";

interface TaskOption {
  id: string;
  title: string;
  subjectName: string | null;
  dueAt: string | null;
}

type Step = "select" | "context" | "paste" | "preview";

export function GeminiFlow({ tasks }: { tasks: TaskOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");
  const [selectedIds, setSelectedIds] = useState<string[]>(tasks.slice(0, 5).map((t) => t.id));
  const [includeGoal, setIncludeGoal] = useState(true);
  const [context, setContext] = useState<BuildContextResult | null>(null);
  const [rawResponse, setRawResponse] = useState("");
  const [importState, setImportState] = useState<ImportProposalState | null>(null);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Record<string, boolean>>({});
  const [acceptedPrefs, setAcceptedPrefs] = useState<Record<string, boolean>>({});
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleTask(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function taskTitle(taskId: string): string {
    return tasks.find((t) => t.id === taskId)?.title ?? taskId;
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2 text-xs text-foreground/50">
        <li className={step === "select" ? "font-semibold text-brand-violet" : ""}>1. Elegir</li>
        <li>›</li>
        <li className={step === "context" ? "font-semibold text-brand-violet" : ""}>2. Copiar y abrir Gemini</li>
        <li>›</li>
        <li className={step === "paste" || step === "preview" ? "font-semibold text-brand-violet" : ""}>3. Traer la respuesta</li>
      </ol>

      {step === "select" && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-medium">¿Qué tareas quieres que Gemini te ayude a planificar?</p>
          {tasks.length === 0 ? (
            <p className="text-sm text-foreground/50">No tienes tareas pendientes para incluir.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleTask(t.id)} />
                  {t.title} {t.subjectName ? <span className="text-foreground/40">· {t.subjectName}</span> : null}
                </label>
              ))}
            </div>
          )}

          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeGoal} onChange={(e) => setIncludeGoal(e.target.checked)} />
            Incluir mi objetivo académico declarado en el perfil
          </label>
          <p className="mt-2 text-xs text-foreground/40">
            No se envía tu nombre, correo, ni el contenido completo de tus materiales — solo título, asignatura,
            fecha y estimación de las tareas que elijas.
          </p>

          <button
            disabled={selectedIds.length === 0 || isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await buildGeminiExport(selectedIds, includeGoal);
                setContext(result);
                setStep("context");
              })
            }
            className="brand-gradient mt-4 rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Preparando…" : "Generar contexto"}
          </button>
        </div>
      )}

      {step === "context" && context && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-2 text-sm font-medium">Este es el contexto — puedes editarlo antes de copiarlo</p>
          <textarea
            value={context.contextText}
            onChange={(e) => setContext({ ...context, contextText: e.target.value })}
            rows={12}
            className="w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
          />

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(context.contextText);
                  setCopyStatus("Copiado ✓");
                } catch {
                  setCopyStatus("No se pudo copiar automáticamente — selecciona el texto manualmente.");
                }
              }}
              className="rounded-full border border-brand-violet px-4 py-2 text-sm font-medium text-brand-violet hover:bg-brand-violet/10"
            >
              📋 Copiar contexto
            </button>
            <a
              href={GEMINI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-foreground/5"
            >
              Abrir Gemini ↗
            </a>
            <button
              onClick={() => setStep("paste")}
              className="brand-gradient rounded-full px-4 py-2 text-sm font-medium text-white"
            >
              Ya tengo la respuesta →
            </button>
          </div>
          {copyStatus && <p className="mt-2 text-xs text-brand-violet">{copyStatus}</p>}
          <p className="mt-3 text-xs text-foreground/50">
            Pega el contexto en el chat de Gemini que se abrió, y trae aquí su propuesta para incorporarla.
          </p>
        </div>
      )}

      {step === "paste" && context && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-2 text-sm font-medium">Pega aquí la respuesta completa de Gemini</p>
          <textarea
            value={rawResponse}
            onChange={(e) => setRawResponse(e.target.value)}
            rows={10}
            placeholder="Pega el JSON (o el bloque ```json ... ```) que te devolvió Gemini"
            className="w-full rounded-lg border border-border bg-background p-3 font-mono text-xs"
          />

          {importState?.error && (
            <div className="mt-2 rounded-lg border border-brand-urgent/40 bg-brand-urgent/10 p-3 text-sm text-brand-urgent">
              <p>{importState.error}</p>
              {importState.issues && (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {importState.issues.map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            disabled={!rawResponse.trim() || isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await importGeminiProposal(context.proposalId, rawResponse);
                setImportState(result);
                if (result.proposal) {
                  setAcceptedSuggestions(Object.fromEntries(result.proposal.suggestions.map((s) => [s.taskId, true])));
                  setAcceptedPrefs({});
                  setStep("preview");
                }
              })
            }
            className="brand-gradient mt-3 rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Validando…" : "Validar y previsualizar"}
          </button>
        </div>
      )}

      {step === "preview" && importState?.proposal && context && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-brand-violet">Resumen de Gemini</p>
          <p className="mt-1 text-sm text-foreground/80">{importState.proposal.summary}</p>

          {importState.proposal.openQuestions.length > 0 && (
            <div className="mt-3 rounded-lg border border-brand-warning/40 bg-brand-warning/10 p-3 text-sm">
              <p className="font-medium text-brand-warning">Preguntas de Gemini (sin responder automáticamente):</p>
              <ul className="mt-1 list-disc pl-5">
                {importState.proposal.openQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {importState.proposal.suggestions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Sugerencias por tarea — elige cuáles aplicar</p>
              <div className="flex flex-col gap-2">
                {importState.proposal.suggestions.map((s) => (
                  <label key={s.taskId} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={acceptedSuggestions[s.taskId] ?? false}
                      onChange={(e) => setAcceptedSuggestions((prev) => ({ ...prev, [s.taskId]: e.target.checked }))}
                    />
                    <span>
                      <span className="font-medium">{taskTitle(s.taskId)}</span> — {s.objective} (
                      {s.method}, ~{s.estimatedMinutes} min)
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {importState.proposal.preferenceChanges.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Cambios de preferencia sugeridos</p>
              <div className="flex flex-col gap-2">
                {importState.proposal.preferenceChanges.map((c) => (
                  <label key={c.field} className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={acceptedPrefs[c.field] ?? false}
                      onChange={(e) => setAcceptedPrefs((prev) => ({ ...prev, [c.field]: e.target.checked }))}
                    />
                    <span>
                      <span className="font-medium">{c.field}</span> → {JSON.stringify(c.value)}. {c.reason}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {applyMessage && <p className="mt-3 text-sm text-brand-success">{applyMessage}</p>}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await applyGeminiProposal({
                    proposalId: context.proposalId,
                    acceptedTaskIds: Object.entries(acceptedSuggestions).filter(([, v]) => v).map(([k]) => k),
                    acceptedPreferenceFields: Object.entries(acceptedPrefs).filter(([, v]) => v).map(([k]) => k),
                  });
                  if (result.error) setImportState({ error: result.error });
                  else {
                    setApplyMessage("Cambios aplicados a tu plan y preferencias.");
                    router.refresh();
                  }
                })
              }
              className="brand-gradient rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isPending ? "Aplicando…" : "Aplicar cambios seleccionados"}
            </button>
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await dismissGeminiProposal(context.proposalId);
                  setStep("select");
                  setImportState(null);
                })
              }
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-foreground/5"
            >
              Descartar propuesta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
