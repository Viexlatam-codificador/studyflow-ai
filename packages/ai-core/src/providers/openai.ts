import type {
  AICompletionRequest,
  AICompletionResult,
  AIProvider,
  AIStructuredRequest,
  AIStructuredResult,
} from "../types";
import { AIProviderNotConfiguredError } from "../types";

const OPENAI_CHAT_MODEL = "gpt-4o";
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

/** Attaches request.images (if any) to the last message as OpenAI's
 * multimodal content-parts format; other messages stay plain strings. */
function buildOpenAIMessages(request: AICompletionRequest) {
  if (!request.images || request.images.length === 0) return request.messages;

  return request.messages.map((message, index) => {
    const isLast = index === request.messages.length - 1;
    if (!isLast) return message;

    return {
      role: message.role,
      content: [
        { type: "text", text: message.content },
        ...request.images!.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        })),
      ],
    };
  });
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private readonly apiKey: string;

  constructor(apiKey: string | undefined = process.env.OPENAI_API_KEY) {
    if (!apiKey) throw new AIProviderNotConfiguredError("openai", "OPENAI_API_KEY");
    this.apiKey = apiKey;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_CHAT_MODEL,
        messages: buildOpenAIMessages(request),
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.4,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI completion failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    return {
      content: json.choices[0]?.message?.content ?? "",
      provider: this.name,
      model: OPENAI_CHAT_MODEL,
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
  }

  async extractStructured<T>(request: AIStructuredRequest<T>): Promise<AIStructuredResult<T>> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_CHAT_MODEL,
        messages: buildOpenAIMessages(request),
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.2,
        response_format: {
          type: "json_schema",
          json_schema: { name: request.schemaName, schema: request.schema, strict: true },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI structured extraction failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    const raw = json.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as T & { confidence?: number };

    return {
      data: parsed,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      usage: {
        provider: this.name,
        model: OPENAI_CHAT_MODEL,
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
      },
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: OPENAI_EMBEDDING_MODEL, input: texts }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI embedding failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    return json.data.map((d: { embedding: number[] }) => d.embedding);
  }
}
