/**
 * Google Gemini AI provider.
 *
 * This is a stub/skeleton for Phase 3.
 * The interface is defined and typed — implementation will be
 * filled in when we install the Google Generative AI SDK.
 *
 * DO NOT import this directly from application code.
 * Use the AIService abstraction instead.
 */

import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
} from "@/lib/ai/types";
import { AppError, ErrorCode } from "@/lib/errors";

export class GeminiProvider implements AIProvider {
  readonly providerName = "gemini";
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model = "gemini-1.5-flash") {
    this.apiKey = apiKey;
    this.modelName = model;
  }

  async complete(_request: AICompletionRequest): Promise<AICompletionResponse> {
    // Phase 3: Implement with @google/generative-ai SDK
    throw new AppError(
      ErrorCode.AI_PROVIDER_ERROR,
      "Gemini provider not yet implemented — coming in Phase 3",
      501
    );
  }

  async healthCheck(): Promise<boolean> {
    // Phase 3: Implement actual health check
    return !!this.apiKey;
  }
}
