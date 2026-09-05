"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { createMaterialRecord } from "@/lib/actions/materials";

const ACCEPTED_TYPES = ["application/pdf", "text/plain", "text/markdown"];

export function UploadForm({ userId, subjects }: { userId: string; subjects: { id: string; name: string }[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    if (selected && !ACCEPTED_TYPES.includes(selected.type)) {
      setError("Por ahora solo se aceptan PDF, TXT o Markdown.");
      setFile(null);
      return;
    }
    setFile(selected);
    if (selected && !title) setTitle(selected.name.replace(/\.[^.]+$/, ""));
  }

  function handleSubmit(subjectId: string) {
    if (!file) {
      setError("Selecciona un archivo primero.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const supabase = createClient();
      const path = `${userId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage.from("course-materials").upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) {
        setError(`No se pudo subir el archivo: ${uploadError.message}`);
        return;
      }

      const formData = new FormData();
      formData.set("title", title || file.name);
      formData.set("storage_path", path);
      formData.set("file_type", file.type);
      if (subjectId) formData.set("subject_id", subjectId);

      await createMaterialRecord(formData);
    });
  }

  return (
    <form
      action={(formData) => handleSubmit((formData.get("subject_id") as string) || "")}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        onChange={handleFileChange}
        className="text-sm"
      />

      {file && (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del material"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          {subjects.length > 0 && (
            <select name="subject_id" className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Sin asignatura</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {error && <p className="text-sm text-brand-urgent">{error}</p>}

      <button
        type="submit"
        disabled={!file || isPending}
        className="brand-gradient self-start rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Subiendo…" : "Subir material"}
      </button>
    </form>
  );
}
