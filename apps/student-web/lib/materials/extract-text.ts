import "server-only";
import { PDFParse } from "pdf-parse";

const MAX_CHARS_FOR_AI = 20000;

export class UnsupportedFileTypeError extends Error {
  constructor(fileType: string) {
    super(`Tipo de archivo no soportado todavía: ${fileType}. Por ahora StudyFlow acepta PDF, TXT y Markdown.`);
    this.name = "UnsupportedFileTypeError";
  }
}

/** Extracts plain text from an uploaded file, truncated to a length that's
 * safe to send to an LLM. DOCX/PPTX are Fase 2 (need a different parser). */
export async function extractText(buffer: ArrayBuffer, fileType: string): Promise<string> {
  let text: string;

  if (fileType === "application/pdf") {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }
  } else if (fileType === "text/plain" || fileType === "text/markdown") {
    text = new TextDecoder("utf-8").decode(buffer);
  } else {
    throw new UnsupportedFileTypeError(fileType);
  }

  return text.length > MAX_CHARS_FOR_AI ? `${text.slice(0, MAX_CHARS_FOR_AI)}\n\n[...truncado...]` : text;
}
