"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { extractFromInboxText, confirmInboxItem, discardInboxItem, type InboxDraft } from "@/lib/actions/inbox";
import { extractFromInboxPhoto } from "@/lib/actions/inbox-photo";
import { createClient } from "@/lib/supabase/client";

const COMING_SOON_OPTIONS = ["Lo dijo el profesor", "Evaluación", "Trabajo grupal", "Evento", "Recordatorio"];

type Mode = "text" | "photo";

export function InboxClient({ subjects, userId }: { subjects: { id: string; name: string }[]; userId: string }) {
  const [mode, setMode] = useState<Mode>("text");
  const [rawText, setRawText] = useState("");
  const [draft, setDraft] = useState<InboxDraft | null>(null);
  const [isPending, startTransition] = useTransition();

  if (draft) {
    return <ReviewDraft draft={draft} subjects={subjects} onDiscard={() => setDraft(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">
        <ModeTab active={mode === "text"} onClick={() => setMode("text")}>
          Escribir tarea
        </ModeTab>
        <ModeTab active={mode === "photo"} onClick={() => setMode("photo")}>
          Foto de la pizarra
        </ModeTab>
      </div>

      {mode === "text" ? (
        <div className="rounded-2xl border border-border bg-card p-4">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={4}
            placeholder='Ej: "El profe dijo que el miércoles tenemos que llevar un benchmark de tres competidores y hacer una presentación, vale 20%."'
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-brand-violet"
          />
          <button
            disabled={!rawText.trim() || isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await extractFromInboxText(rawText);
                setDraft(result);
              })
            }
            className="brand-gradient mt-3 rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Analizando…" : "Detectar tarea"}
          </button>
          <p className="mt-2 text-xs text-foreground/40">
            Funciona con o sin IA configurada — StudyFlow reconoce fechas (&ldquo;mañana&rdquo;, &ldquo;el
            viernes&rdquo;), porcentajes de nota y tus asignaturas directamente del texto.
          </p>
        </div>
      ) : (
        <PhotoCapture userId={userId} onDraft={setDraft} />
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/materials"
          className="rounded-full border border-brand-violet/40 bg-brand-violet/10 px-3 py-1.5 text-xs font-medium text-brand-violet hover:bg-brand-violet/20"
        >
          Subir documento →
        </Link>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground/60">Próximamente</p>
        <div className="flex flex-wrap gap-2">
          {COMING_SOON_OPTIONS.map((opt) => (
            <span
              key={opt}
              className="cursor-not-allowed rounded-full border border-border px-3 py-1.5 text-xs text-foreground/40"
            >
              {opt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? "brand-gradient text-white" : "border border-border text-foreground/60"
      }`}
    >
      {children}
    </button>
  );
}

function PhotoCapture({ userId, onDraft }: { userId: string; onDraft: (draft: InboxDraft) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }

  function handleSubmit() {
    if (!file) return;
    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const path = `${userId}/whiteboard/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage.from("course-materials").upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) {
        setError(`No se pudo subir la foto: ${uploadError.message}`);
        return;
      }

      try {
        const draft = await extractFromInboxPhoto(path, file.type);
        onDraft(draft);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo procesar la foto.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="text-sm"
      />

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Vista previa de la pizarra" className="mt-3 max-h-64 w-full rounded-xl object-contain" />
      )}

      {error && <p className="mt-2 text-sm text-brand-urgent">{error}</p>}

      <button
        disabled={!file || isPending}
        onClick={handleSubmit}
        className="brand-gradient mt-3 rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Leyendo la foto…" : "Detectar tarea"}
      </button>
      <p className="mt-2 text-xs text-foreground/40">
        Requiere un proveedor de IA con visión (OpenAI/Anthropic/Google) configurado — a diferencia del texto,
        leer una foto no tiene un modo sin IA.
      </p>
    </div>
  );
}

function ReviewDraft({
  draft,
  subjects,
  onDiscard,
}: {
  draft: InboxDraft;
  subjects: { id: string; name: string }[];
  onDiscard: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => startTransition(() => confirmInboxItem(formData))}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <input type="hidden" name="inbox_item_id" value={draft.inboxItemId} />

      <div>
        <p className="text-sm font-medium text-brand-violet">
          Tarea detectada {draft.aiGenerated ? "(con IA)" : ""}
        </p>
        {draft.confidence < 0.6 && (
          <p className="mt-1 text-xs text-brand-warning">
            Confianza {Math.round(draft.confidence * 100)}% — revisa y completa lo que falte antes de guardar.
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Título</span>
        <input
          name="title"
          defaultValue={draft.title}
          required
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Descripción</span>
        <textarea
          name="description"
          defaultValue={draft.description}
          rows={3}
          className="rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {subjects.length > 0 && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Asignatura</span>
            <select
              name="subject_id"
              defaultValue={draft.subjectId ?? ""}
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="">Sin asignatura</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Fecha límite</span>
          <input
            type="datetime-local"
            name="due_at"
            defaultValue={draft.dueAt ? draft.dueAt.slice(0, 16) : ""}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Peso de nota (%)</span>
          <input
            type="number"
            name="grade_weight"
            defaultValue={draft.gradeWeight ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Minutos estimados</span>
          <input
            type="number"
            name="estimated_minutes"
            defaultValue={draft.estimatedMinutes ?? ""}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="brand-gradient rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Guardando…" : "¿Agregar a StudyFlow?"}
        </button>
        <button
          type="button"
          onClick={() => startTransition(async () => { await discardInboxItem(draft.inboxItemId); onDiscard(); })}
          className="rounded-full border border-border px-5 py-2 text-sm font-medium"
        >
          Descartar
        </button>
      </div>
    </form>
  );
}
