"use client";

import { useState, useTransition } from "react";
import { inviteCollaborator, removeCollaborator, updateCollaborativeDocUrl } from "@/lib/actions/collaboration";
import type { TaskCollaborator } from "@/lib/data/task-detail";

export function CollaborationPanel({
  taskId,
  isOwner,
  collaborators,
  collaborativeDocUrl,
}: {
  taskId: string;
  isOwner: boolean;
  collaborators: TaskCollaborator[];
  collaborativeDocUrl: string | null;
}) {
  const [email, setEmail] = useState("");
  const [docUrl, setDocUrl] = useState(collaborativeDocUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isGroupWork = collaborators.length > 0 || Boolean(collaborativeDocUrl);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <p className="font-medium">Trabajo grupal</p>
        <p className="text-sm text-foreground/60">
          {isGroupWork
            ? "Tus compañeros invitados pueden ver y avanzar esta tarea."
            : "Invita compañeros por correo para trabajar esto juntos."}
        </p>
      </div>

      {collaborators.length > 0 && (
        <ul className="flex flex-col gap-2">
          {collaborators.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <span>
                {c.userName ?? c.invitedEmail}{" "}
                {c.status === "PENDING" && <span className="text-xs text-brand-warning">(pendiente de unirse)</span>}
              </span>
              {isOwner && (
                <button
                  onClick={() => startTransition(() => removeCollaborator(c.id, taskId))}
                  className="text-xs text-foreground/40 hover:text-brand-urgent"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <form
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              try {
                await inviteCollaborator(taskId, formData.get("email") as string);
                setEmail("");
              } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudo invitar.");
              }
            })
          }
          className="flex gap-2"
        >
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@duocuc.cl"
            required
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="brand-gradient rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Invitar
          </button>
        </form>
      )}
      {error && <p className="text-sm text-brand-urgent">{error}</p>}

      <div className="border-t border-border pt-4">
        <p className="mb-1 text-sm font-medium">Documento colaborativo</p>
        <p className="mb-2 text-xs text-foreground/50">
          Pega aquí el enlace para compartir de tu Word, Excel o PowerPoint Online (desde tu cuenta de correo
          estudiantil) — StudyFlow no crea el documento, solo le da un lugar fijo al grupo.
        </p>
        {isOwner ? (
          <form
            action={() =>
              startTransition(async () => {
                setError(null);
                try {
                  await updateCollaborativeDocUrl(taskId, docUrl);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "No se pudo guardar el enlace.");
                }
              })
            }
            className="flex gap-2"
          >
            <input
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="https://365.office.com/..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              Guardar
            </button>
          </form>
        ) : collaborativeDocUrl ? (
          <a
            href={collaborativeDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="brand-gradient inline-block rounded-full px-4 py-2 text-sm font-medium text-white"
          >
            Abrir documento →
          </a>
        ) : (
          <p className="text-sm text-foreground/40">Aún no hay un documento enlazado.</p>
        )}
      </div>
    </div>
  );
}
