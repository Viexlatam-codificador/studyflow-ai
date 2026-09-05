export type AIMessageRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface AIImageInput {
  base64: string;
  mimeType: string;
}

export interface AICompletionRequest {
  /** Which StudyFlow feature is calling the AI — logged to ai_usage for cost tracking. */
  feature:
    | "INBOX_EXTRACTION"
    | "WHITEBOARD_EXTRACTION"
    | "AUDIO_EXTRACTION"
    | "TUTOR_CHAT"
    | "SMART_PLANNER"
    | "TASK_ASSISTANT"
    | "EXAM_PREP";
  userId: string;
  messages: AIMessage[];
  /** Attached to the last user message — only OpenAI/Anthropic/Google's
   * multimodal chat endpoints support this; each adapter formats it for
   * its own API (see WHITEBOARD_EXTRACTION in the Inbox photo flow). */
  images?: AIImageInput[];
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResult {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIStructuredRequest<T> extends AICompletionRequest {
  /** JSON Schema the response must conform to. */
  schema: Record<string, unknown>;
  /** Used only for logging/debugging, doesn't affect parsing. */
  schemaName: string;
}

export interface AIStructuredResult<T> {
  data: T;
  /** 0..1 — how confident the model was. Below the threshold, StudyFlow
   * must still require user confirmation (see INBOX_REQUIRES_CONFIRMATION
   * in @studyflow/shared) regardless of this value. */
  confidence: number;
  usage: Pick<AICompletionResult, "provider" | "model" | "inputTokens" | "outputTokens">;
}

/**
 * Every AI feature in StudyFlow talks to this interface, never to a specific
 * vendor SDK directly. Swapping OpenAI for Anthropic or Gemini means adding
 * an adapter here and flipping AI_PROVIDER — no product code changes.
 */
export interface AIProvider {
  readonly name: string;
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
  extractStructured<T>(request: AIStructuredRequest<T>): Promise<AIStructuredResult<T>>;
  embed(texts: string[]): Promise<number[][]>;
}

export class AIProviderNotConfiguredError extends Error {
  constructor(provider: string, envVar: string) {
    super(`AI provider "${provider}" is not configured — missing ${envVar}. See .env.example.`);
    this.name = "AIProviderNotConfiguredError";
  }
}
