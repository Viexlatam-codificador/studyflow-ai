"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createMaterialRecords, type MaterialUploadItem } from "@/lib/actions/materials";

// Everything a student actually tries to upload — apuntes fotografiados,
// guías en PDF, o lo que el profesor comparte en Word/PowerPoint/Excel.
// Only PDF/TXT/Markdown get an AI summary today (see extract-text.ts), but
// every other type still uploads and stays downloadable — storing the file
// isn't the same as being able to summarize it.
const ACCEPTED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

interface PendingFile {
  file: File;
  title: string;
  status: "pending" | "uploading" | "done" | "error";
  errorMessage?: string;
}

function cleanTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

const ACCEPTED_EXTENSIONS = [
  "pdf",
  "txt",
  "md",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
];

// Some browsers/OS report an empty or generic MIME type for .md/.heic files —
// fall back to the extension so those don't get rejected for no real reason.
function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return !!ext && ACCEPTED_EXTENSIONS.includes(ext);
}

export function UploadForm({ userId, subjects }: { userId: string; subjects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [items, setItems] = useState<PendingFile[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [shareWithSubject, setShareWithSubject] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const accepted = selected.filter(isAcceptedFile);
    const bad = selected.filter((f) => !isAcceptedFile(f)).map((f) => f.name);

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
    setSaveError(null);

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
        uploaded.push({
          title,
          storagePath: path,
          fileType: file.type,
          subjectId: subjectId || null,
          shareWithSubject,
        });
      }

      if (uploaded.length > 0) {
        try {
          await createMaterialRecords(uploaded);
          router.refresh();
          // Clear only the ones that succeeded — leave failed ones visible to retry/remove.
          setItems((prev) => prev.filter((item) => item.status === "error"));
        } catch (err) {
          const message = err instanceof Error ? err.message : "No se pudo guardar el material.";
          setSaveError(message);
        }
      } else {
        setItems((prev) => prev.filter((item) => item.status === "error"));
      }
    });
  }

  const readyCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={`.pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,${ACCEPTED_TYPES.join(",")}`}
        onChange={handleFileChange}
        className="text-sm"
      />
      <p className="text-xs text-foreground/40">
        Puedes seleccionar varios archivos a la vez: PDF, Word, PowerPoint, Excel, fotos o texto plano.
      </p>

      {rejected.length > 0 && (
        <p className="rounded-lg border border-brand-urgent/40 bg-brand-urgent/10 px-3 py-2 text-sm font-medium text-brand-urgent">
          ⚠️ No se pudieron subir estos archivos (formato no soportado): {rejected.join(", ")}
        </p>
      )}

      {saveError && (
        <p className="rounded-lg border border-brand-urgent/40 bg-brand-urgent/10 px-3 py-2 text-sm font-medium text-brand-urgent">
          ⚠️ El archivo se subió pero no se pudo guardar: {saveError}
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

          {subjectId && (
            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <input
                type="checkbox"
                checked={shareWithSubject}
                onChange={(e) => setShareWithSubject(e.target.checked)}
              />
              Compartir con mis compañeros de esta asignatura
            </label>
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
