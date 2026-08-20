/**
 * AI Service — the single entry point for all AI operations.
 *
 * Application code imports from here, not from individual providers.
 * This is where provider selection, failover, and usage tracking will live.
 */

import type { AIProvider, AIProviderConfig, SupportedAIProvider } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { AppError, ErrorCode } from "@/lib/errors";

export * from "./types";

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case "gemini":
      return new GeminiProvider(config.apiKey, config.model);
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model);
    case "anthropic":
      return new AnthropicProvider(config.apiKey, config.model);
    default: {
      const exhaustive: never = config.provider;
      throw new AppError(
        ErrorCode.CONFIGURATION_ERROR,
        `Unknown AI provider: ${exhaustive}`,
        500
      );
    }
  }
}

/**
 * Get the default provider name from environment configuration.
 * This is used when a business does not have a specific provider configured.
 */
export function getDefaultProviderName(): SupportedAIProvider {
  const provider = process.env.AI_DEFAULT_PROVIDER as SupportedAIProvider | undefined;
  if (provider && ["gemini", "openai", "anthropic"].includes(provider)) {
    return provider;
  }
  return "gemini";
}
