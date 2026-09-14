export type AiProvider = "chatgpt" | "gemini" | "claude" | "notebooklm";

export const AI_PROVIDERS: { id: AiProvider; label: string; note: string }[] = [
  { id: "chatgpt", label: "ChatGPT", note: "Abre el chat con tu pregunta ya escrita." },
  { id: "gemini", label: "Gemini", note: "Abre Gemini — pega el texto copiado." },
  { id: "claude", label: "Claude", note: "Abre Claude — pega el texto copiado." },
  { id: "notebooklm", label: "NotebookLM", note: "Abre NotebookLM — crea una fuente nueva y pega el texto." },
];

export function buildStudyPrompt(task: {
  title: string;
  description?: string | null;
  subjectName?: string | null;
  dueAt?: string | null;
}): string {
  const lines = [
    `Ayúdame a avanzar en esta tarea: "${task.title}".`,
    task.subjectName ? `Asignatura: ${task.subjectName}.` : null,
    task.description ? `Detalle: ${task.description}` : null,
    task.dueAt ? `Fecha límite: ${task.dueAt}.` : null,
    "Explícame paso a paso qué debo hacer, hazme preguntas si falta información, y ayúdame a organizar mi avance.",
  ].filter(Boolean);
  return lines.join("\n");
}

// ChatGPT is the only one of these with a documented way to open a new chat
// with text already in the composer (?q=). Gemini, Claude and NotebookLM
// have no such public param, so for those we just open the app and rely on
// the clipboard copy — no fake prefill, no scraping, no unofficial APIs.
export function buildAiUrl(provider: AiProvider, prompt: string): string {
  switch (provider) {
    case "chatgpt":
      return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
    case "gemini":
      return "https://gemini.google.com/app";
    case "claude":
      return "https://claude.ai/new";
    case "notebooklm":
      return "https://notebooklm.google.com/";
  }
}
