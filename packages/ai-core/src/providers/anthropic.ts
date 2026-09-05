import type {
  AICompletionRequest,
  AICompletionResult,
  AIProvider,
  AIStructuredRequest,
  AIStructuredResult,
} from "../types";
import { AIProviderNotConfiguredError } from "../types";

const ANTHROPIC_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private readonly apiKey: string;

  constructor(apiKey: string | undefined = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) throw new AIProviderNotConfiguredError("anthropic", "ANTHROPIC_API_KEY");
    this.apiKey = apiKey;
  }

  private splitSystem(request: AICompletionRequest) {
    const system = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const rest = request.messages.filter((m) => m.role !== "system");

    if (!request.images || request.images.length === 0) {
      return { system, messages: rest };
    }

    const messages = rest.map((message, index) => {
      const isLast = index === rest.length - 1;
      if (!isLast) return message;

      return {
        role: message.role,
        content: [
          { type: "text", text: message.content },
          ...request.images!.map((img) => ({
            type: "image",
            source: { type: "base64", media_type: img.mimeType, data: img.base64 },
          })),
        ],
      };
    });

    return { system, messages };
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const { system, messages } = this.splitSystem(request);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        system: system || undefined,
        messages,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.4,
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic completion failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    return {
      content: json.content?.[0]?.text ?? "",
      provider: this.name,
      model: ANTHROPIC_MODEL,
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
    };
  }

  async extractStructured<T>(request: AIStructuredRequest<T>): Promise<AIStructuredResult<T>> {
    const { system, messages } = this.splitSystem(request);
    const instructions = `${system}\n\nRespond ONLY with valid JSON matching this schema (no prose, no markdown fences):\n${JSON.stringify(
      request.schema
    )}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        system: instructions,
        messages,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.2,
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic structured extraction failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    const raw = json.content?.[0]?.text ?? "{}";
    const parsed = JSON.parse(raw) as T & { confidence?: number };

    return {
      data: parsed,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      usage: {
        provider: this.name,
        model: ANTHROPIC_MODEL,
        inputTokens: json.usage?.input_tokens ?? 0,
        outputTokens: json.usage?.output_tokens ?? 0,
      },
    };
  }

  async embed(): Promise<number[][]> {
    throw new Error(
      "Anthropic does not offer an embeddings API. Configure a different AI_PROVIDER for embedding-dependent features (RAG), e.g. openai."
    );
  }
}
