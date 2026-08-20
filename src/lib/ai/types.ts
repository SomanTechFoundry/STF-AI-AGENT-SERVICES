/**
 * AI provider abstraction types.
 *
 * The application communicates with this interface, not with
 * any specific AI provider SDK. This allows swapping or adding
 * providers without changing agent logic.
 */

// ============================================================
// Message types (provider-agnostic)
// ============================================================

export type AIMessageRole = "system" | "user" | "assistant" | "tool";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  toolCallId?: string;   // For tool result messages
  toolCalls?: AIToolCall[];  // For assistant messages that invoke tools
}

// ============================================================
// Tool definitions (provider-agnostic)
// ============================================================

export interface AIToolParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  items?: AIToolParameter;          // For array types
  properties?: Record<string, AIToolParameter>;  // For object types
  required?: string[];
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, AIToolParameter>;
    required?: string[];
  };
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIToolResult {
  toolCallId: string;
  result: unknown;
  isError?: boolean;
}

// ============================================================
// Request / Response
// ============================================================

/**
 * Callback the provider calls to execute tools during its internal loop.
 * Returning results as serialized JSON strings keeps the interface simple
 * and provider-agnostic.
 */
export type ToolExecutor = (
  calls: AIToolCall[]
) => Promise<Array<{ toolCallId: string; result: unknown }>>;

export interface AICompletionRequest {
  messages: AIMessage[];
  tools?: AIToolDefinition[];
  /**
   * If provided, the provider runs the complete tool-calling loop internally
   * using a single session. This is required for models that use thought
   * signatures (e.g. Gemini thinking models), where rebuilding message
   * history across calls strips the signatures and causes API errors.
   */
  toolExecutor?: ToolExecutor;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AICompletionResponse {
  message: AIMessage;
  toolCalls?: AIToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: "stop" | "tool_calls" | "max_tokens" | "error";
  provider: string;
  model: string;
  durationMs: number;
}

// ============================================================
// Provider interface — every provider must implement this
// ============================================================

export interface AIProvider {
  readonly providerName: string;
  readonly modelName: string;

  complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Check if the provider is configured and reachable.
   * Used for health checks and failover detection.
   */
  healthCheck(): Promise<boolean>;
}

// ============================================================
// Provider configuration
// ============================================================

export type SupportedAIProvider = "gemini" | "openai" | "anthropic";

export interface AIProviderConfig {
  provider: SupportedAIProvider;
  model: string;
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
}
