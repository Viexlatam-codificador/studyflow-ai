"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createMaterialRecords, type MaterialUploadItem } from "@/lib/actions/materials";

const ACCEPTED_TYPES = ["application/pdf", "text/plain", "text/markdown"];

interface PendingFile {
  file: File;
  title: string;
  status: "pending" | "uploading" | "done" | "error";
  errorMessage?: string;
}

function cleanTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

export function UploadForm({ userId, subjects }: { userId: string; subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [items, setItems] = useState<PendingFile[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [rejected, setRejected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const accepted = selected.filter((f) => ACCEPTED_TYPES.includes(f.type));
    const bad = selected.filter((f) => !ACCEPTED_TYPES.includes(f.type)).map((f) => f.name);

    setRejected(bad);
    setItems((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, title: cleanTitle(file.name), status: "pending" as const })),
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTitle(index: number, title: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, title } : item)));
  }

  function handleSubmit() {
    if (items.length === 0) return;

    startTransition(async () => {
      const supabase = createClient();
      const uploaded: MaterialUploadItem[] = [];

      for (let i = 0; i < items.length; i++) {
        setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "uploading" } : item)));
        const { file, title } = items[i];
        const path = `${userId}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage.from("course-materials").upload(path, file, {
          contentType: file.type,
        });

        if (uploadError) {
          setItems((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: "error", errorMessage: uploadError.message } : item
            )
          );
          continue;
        }

        setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: "done" } : item)));
        uploaded.push({ title, storagePath: path, fileType: file.type, subjectId: subjectId || null });
      }

      if (uploaded.length > 0) {
        await createMaterialRecords(uploaded);
        router.refresh();
      }

      // Clear only the ones that succeeded — leave failed ones visible to retry/remove.
      setItems((prev) => prev.filter((item) => item.status === "error"));
    });
  }

  const readyCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        onChange={handleFileChange}
        className="text-sm"
      />
      <p className="text-xs text-foreground/40">
        Puedes seleccionar varios archivos a la vez (PDF, TXT o Markdown).
      </p>

      {rejected.length > 0 && (
        <p className="text-sm text-brand-urgent">
          No se aceptaron (formato no soportado): {rejected.join(", ")}
        </p>
      )}

      {items.length > 0 && (
        <>
          {subjects.length > 0 && (
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Sin asignatura (aplica a todos)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div key={`${item.file.name}-${i}`} className="flex items-center gap-2">
                <input
                  value={item.title}
                  onChange={(e) => updateTitle(i, e.target.value)}
                  disabled={item.status !== "pending"}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60"
                />
                <StatusBadge status={item.status} />
                {item.status === "pending" && (
                  <button
                    onClick={() => removeItem(i)}
                    aria-label="Quitar"
                    className="text-foreground/30 hover:text-brand-urgent"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <button
        onClick={handleSubmit}
        disabled={readyCount === 0 || isPending}
        className="brand-gradient self-start rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Subiendo…" : `Subir ${readyCount > 1 ? `${readyCount} materiales` : "material"}`}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: PendingFile["status"] }) {
  if (status === "pending") return null;
  const label = { uploading: "Subiendo…", done: "Listo ✓", error: "Error" }[status];
  const tone = { uploading: "text-foreground/50", done: "text-brand-success", error: "text-brand-urgent" }[status];
  return <span className={`shrink-0 text-xs ${tone}`}>{label}</span>;
}
