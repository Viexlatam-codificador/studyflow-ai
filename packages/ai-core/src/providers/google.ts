import type {
  AICompletionRequest,
  AICompletionResult,
  AIProvider,
  AIStructuredRequest,
  AIStructuredResult,
} from "../types";
import { AIProviderNotConfiguredError } from "../types";

const GOOGLE_MODEL = "gemini-1.5-pro";
const GOOGLE_EMBEDDING_MODEL = "text-embedding-004";

export class GoogleGeminiProvider implements AIProvider {
  readonly name = "google";
  private readonly apiKey: string;

  constructor(apiKey: string | undefined = process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    if (!apiKey) throw new AIProviderNotConfiguredError("google", "GOOGLE_GENERATIVE_AI_API_KEY");
    this.apiKey = apiKey;
  }

  private toGoogleContents(request: AICompletionRequest) {
    const nonSystem = request.messages.filter((m) => m.role !== "system");

    return nonSystem.map((m, index) => {
      const isLast = index === nonSystem.length - 1;
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: m.content },
      ];
      if (isLast && request.images) {
        for (const img of request.images) {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
        }
      }
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });
  }

  private systemInstruction(messages: AICompletionRequest["messages"]) {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    return system ? { parts: [{ text: system }] } : undefined;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: this.toGoogleContents(request),
          systemInstruction: this.systemInstruction(request.messages),
          generationConfig: {
            maxOutputTokens: request.maxTokens ?? 1024,
            temperature: request.temperature ?? 0.4,
          },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Google Gemini completion failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    return {
      content: json.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
      provider: this.name,
      model: GOOGLE_MODEL,
      inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  async extractStructured<T>(request: AIStructuredRequest<T>): Promise<AIStructuredResult<T>> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: this.toGoogleContents(request),
          systemInstruction: this.systemInstruction(request.messages),
          generationConfig: {
            maxOutputTokens: request.maxTokens ?? 1024,
            temperature: request.temperature ?? 0.2,
            responseMimeType: "application/json",
            responseSchema: request.schema,
          },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Google Gemini structured extraction failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(raw) as T & { confidence?: number };

    return {
      data: parsed,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      usage: {
        provider: this.name,
        model: GOOGLE_MODEL,
        inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results = await Promise.all(
      texts.map(async (text) => {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_EMBEDDING_MODEL}:embedContent?key=${this.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: { parts: [{ text }] } }),
          }
        );
        if (!res.ok) {
          throw new Error(`Google Gemini embedding failed: ${res.status} ${await res.text()}`);
        }
        const json = (await res.json()) as any;
        return json.embedding.values as number[];
      })
    );
    return results;
  }
}
