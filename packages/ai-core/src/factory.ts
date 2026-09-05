import type { AIProvider } from "./types";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { GoogleGeminiProvider } from "./providers/google";

export type AIProviderName = "openai" | "anthropic" | "google";

let cachedProvider: AIProvider | null = null;

/**
 * Single entry point the rest of the app uses to talk to AI. Reads
 * AI_PROVIDER from the environment so switching vendors is a config change,
 * never a code change — see .env.example and packages/ai-core/README.md.
 */
export function getAIProvider(providerName?: AIProviderName): AIProvider {
  const name = (providerName ?? (process.env.AI_PROVIDER as AIProviderName) ?? "openai").toLowerCase();

  if (cachedProvider && !providerName && cachedProvider.name === name) {
    return cachedProvider;
  }

  const provider = createProvider(name as AIProviderName);
  if (!providerName) cachedProvider = provider;
  return provider;
}

function createProvider(name: AIProviderName): AIProvider {
  switch (name) {
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "google":
      return new GoogleGeminiProvider();
    default:
      throw new Error(`Unknown AI_PROVIDER "${name}". Expected one of: openai, anthropic, google.`);
  }
}
