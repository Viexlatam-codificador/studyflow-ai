"use client";

import { useState, useTransition } from "react";
import { getOrCreateCalendarFeedToken, regenerateCalendarFeedToken } from "@/lib/actions/calendar";

export function CalendarSyncPanel() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function buildUrl(token: string) {
    return `${window.location.origin}/api/calendar/${token}`;
  }

  function reveal() {
    setOpen(true);
    if (url) return;
    startTransition(async () => {
      const token = await getOrCreateCalendarFeedToken();
      setUrl(buildUrl(token));
    });
  }

  function regenerate() {
    startTransition(async () => {
      const token = await regenerateCalendarFeedToken();
      setUrl(buildUrl(token));
      setCopied(false);
    });
  }

  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {!open ? (
        <button
          onClick={reveal}
          className="rounded-full border border-brand-violet/40 bg-brand-violet/10 px-4 py-2 text-sm font-medium text-brand-violet hover:bg-brand-violet/20"
        >
          🔗 Sincronizar con mi calendario personal
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Tu enlace de calendario</p>
            <p className="text-xs text-foreground/50">
              Agrégalo como calendario &ldquo;por URL&rdquo; en Google Calendar, Apple Calendario u Outlook — se
              actualiza solo cada media hora con tus fechas de StudyFlow.
            </p>
          </div>

          {isPending && !url ? (
            <p className="text-sm text-foreground/50">Generando enlace…</p>
          ) : (
            url && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                />
                <button
                  onClick={copy}
                  className="rounded-full border border-border px-3 py-2 text-xs font-medium hover:bg-background"
                >
                  {copied ? "Copiado ✓" : "Copiar"}
                </button>
              </div>
            )
          )}

          <details className="text-xs text-foreground/60">
            <summary className="cursor-pointer font-medium">¿Cómo lo agrego?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>
                <b>Google Calendar</b>: Otros calendarios → + → &ldquo;Desde URL&rdquo; → pega el enlace.
              </li>
              <li>
                <b>Apple Calendario</b>: Archivo → Nueva suscripción de calendario → pega el enlace.
              </li>
              <li>
                <b>Outlook</b>: Agregar calendario → Suscribirse desde la web → pega el enlace.
              </li>
            </ul>
          </details>

          <button
            onClick={regenerate}
            disabled={isPending}
            className="self-start text-xs text-foreground/40 hover:text-brand-urgent"
          >
            ¿Se filtró el enlace? Generar uno nuevo
          </button>
        </div>
      )}
    </div>
  );
}
