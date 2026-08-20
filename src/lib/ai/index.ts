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

/**
 * Create the default AI provider from environment configuration.
 * Throws ConfigurationError if the required API key is missing.
 */
export function createDefaultAIProvider(): AIProvider {
  const { ConfigurationError } = require("@/lib/errors");
  const providerName = getDefaultProviderName();

  const apiKeyMap: Record<SupportedAIProvider, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };

  const modelMap: Record<SupportedAIProvider, string> = {
    gemini: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
    openai: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    anthropic: process.env.ANTHROPIC_MODEL ?? "claude-3-haiku-20240307",
  };

  const apiKey = apiKeyMap[providerName];
  if (!apiKey) {
    throw new ConfigurationError(
      `AI provider "${providerName}" is configured but its API key is missing. ` +
      `Set the corresponding environment variable (e.g. GEMINI_API_KEY).`
    );
  }

  return createAIProvider({
    provider: providerName,
    model: modelMap[providerName],
    apiKey,
  });
}
