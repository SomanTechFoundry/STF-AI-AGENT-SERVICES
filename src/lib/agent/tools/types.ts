/**
 * Agent tool types and the base tool interface.
 *
 * Every tool the AI agent can call must implement AgentTool.
 * Tools are pure, validated functions — they never expose raw DB errors
 * to the AI and always return structured results.
 */

import type { AIToolDefinition } from "@/lib/ai/types";

/**
 * The execution context passed to every tool.
 * Contains everything the tool needs without requiring it to
 * look up the business or conversation itself.
 */
export interface ToolContext {
  businessId: string;
  conversationId: string;
  requestId: string;
}

/**
 * Standard tool result envelope.
 * success: true  → data contains the result
 * success: false → error contains a safe message the AI can relay to the customer
 */
export type ToolResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Every tool must:
 * 1. Declare its name and Gemini-compatible schema (definition)
 * 2. Execute with validated context and typed arguments (execute)
 */
export interface AgentTool<TArgs = Record<string, unknown>, TResult = unknown> {
  definition: AIToolDefinition;
  execute(args: TArgs, context: ToolContext): Promise<ToolResult<TResult>>;
}

export function toolSuccess<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

export function toolError(message: string): ToolResult<never> {
  return { success: false, error: message };
}
