/**
 * Agent Orchestrator.
 *
 * Coordinates a single customer turn:
 * 1. Load or create the conversation
 * 2. Save the customer message
 * 3. Build system prompt + message history
 * 4. Call the AI provider, passing a toolExecutor callback
 *    — the provider runs the full tool-calling loop internally,
 *      preserving thought_signatures within one session
 * 5. Persist the final agent response + tool call records
 * 6. Return the response to the caller
 */

import { createDefaultAIProvider } from "@/lib/ai";
import type { AIToolCall, ToolExecutor } from "@/lib/ai/types";
import { conversationService } from "@/lib/services/conversation.service";
import type { AgentState } from "@/lib/services/conversation.service";
import { buildSystemPrompt } from "./prompts";
import { SALON_TOOLS, buildToolMap } from "./tools";
import type { ToolContext } from "./tools";
import { logger } from "@/lib/logger";
import { generateRequestId } from "@/lib/utils/id";
import type { Message, ConversationChannel } from "@prisma/client";
import type { AIMessage } from "@/lib/ai/types";

export interface AgentInput {
  businessId: string;
  conversationId?: string;
  channel: ConversationChannel;
  channelIdentifier?: string;
  customerMessage: string;
}

export interface AgentOutput {
  conversationId: string;
  response: string;
  agentState: AgentState;
  toolsUsed: string[];
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
}

export interface AgentStreamMeta {
  conversationId: string;
  agentState: AgentState;
  toolsUsed: string[];
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
}

export async function runAgent(input: AgentInput): Promise<AgentOutput> {
  const startMs = Date.now();
  const requestId = generateRequestId();
  const log = logger.withContext({ businessId: input.businessId, requestId });

  log.info("Agent turn started", { channel: input.channel });

  // ---- 1. Load or create conversation ----
  let conversation = input.conversationId
    ? await conversationService.getById(input.businessId, input.conversationId)
    : null;

  if (!conversation) {
    if (input.channelIdentifier) {
      const result = await conversationService.findOrCreate(
        input.businessId,
        input.channel,
        input.channelIdentifier
      );
      conversation = result.conversation;
    } else {
      conversation = await conversationService.create(input.businessId, {
        channel: input.channel,
      });
    }
  }

  const conversationId = conversation.id;
  log.info("Conversation loaded", { conversationId });

  // ---- 2. Save incoming customer message ----
  await conversationService.appendMessage(conversationId, input.businessId, {
    role: "CUSTOMER",
    content: input.customerMessage,
  });

  // ---- 3. Load history + build prompt ----
  const { messages: dbMessages } = await conversationService.getWithMessages(
    input.businessId,
    conversationId,
    { messageLimit: 40 }
  );

  const systemPrompt = await buildSystemPrompt({ businessId: input.businessId });
  const aiMessages = dbMessagesToAIMessages(dbMessages);

  // ---- 4. Set up tools ----
  const aiProvider = createDefaultAIProvider();
  const toolMap = buildToolMap(SALON_TOOLS);
  const toolDefs = SALON_TOOLS.map((t) => t.definition);
  const toolContext: ToolContext = { businessId: input.businessId, conversationId, requestId };
  const toolsUsed: string[] = [];

  // ---- 5. Build toolExecutor callback ----
  // The provider calls this whenever it needs a tool result.
  // Running tools here keeps all state management outside the provider.
  const toolExecutor: ToolExecutor = async (calls: AIToolCall[]) => {
    const results = [];

    for (const call of calls) {
      const tool = toolMap.get(call.name);
      toolsUsed.push(call.name);

      let result: unknown;
      if (!tool) {
        log.warn("Unknown tool called by AI", { tool: call.name });
        result = { success: false, error: `Unknown tool: ${call.name}` };
      } else {
        try {
          result = await tool.execute(call.arguments, toolContext);
        } catch (err) {
          log.error(`Tool execution failed: ${call.name}`, err);
          result = { success: false, error: `Tool ${call.name} failed. Please try another approach.` };
        }
      }

      log.info("Tool executed", {
        tool: call.name,
        success: (result as { success?: boolean })?.success ?? false,
      });

      results.push({ toolCallId: call.id, result });
    }

    return results;
  };

  // ---- 6. Call AI provider (provider handles the full tool loop) ----
  const aiResponse = await aiProvider.complete({
    messages: aiMessages,
    tools: toolDefs,
    toolExecutor,
    systemPrompt,
    maxTokens: 1024,
    temperature: 0.7,
  });

  // ---- 7. Persist final agent response ----
  await conversationService.appendMessage(conversationId, input.businessId, {
    role: "AGENT",
    content: aiResponse.message.content,
    aiProvider: aiResponse.provider,
    aiModel: aiResponse.model,
    inputTokens: aiResponse.usage.inputTokens,
    outputTokens: aiResponse.usage.outputTokens,
    toolCalls: aiResponse.toolCalls,
    durationMs: aiResponse.durationMs,
  });

  // ---- 8. Return ----
  const updatedConversation = await conversationService.getById(
    input.businessId,
    conversationId
  );

  const durationMs = Date.now() - startMs;
  log.info("Agent turn complete", {
    conversationId,
    toolsUsed,
    inputTokens: aiResponse.usage.inputTokens,
    outputTokens: aiResponse.usage.outputTokens,
    durationMs,
  });

  return {
    conversationId,
    response: aiResponse.message.content,
    agentState: (updatedConversation.agentState as AgentState) ?? {},
    toolsUsed,
    usage: aiResponse.usage,
    durationMs,
  };
}

// ============================================================
// runAgentStream — streams the final AI response token by token
// ============================================================

/**
 * Streaming variant of runAgent.
 *
 * @param input   Same as runAgent
 * @param onChunk Called with each text token as the AI generates the final
 *                response. Tool-call turns are silent (no onChunk calls).
 * @returns       Metadata about the completed turn (no "response" field —
 *                the full text was delivered via onChunk).
 */
export async function runAgentStream(
  input: AgentInput,
  onChunk: (text: string) => void
): Promise<AgentStreamMeta> {
  const startMs = Date.now();
  const requestId = generateRequestId();
  const log = logger.withContext({ businessId: input.businessId, requestId });

  log.info("Agent stream turn started", { channel: input.channel });

  // ---- 1. Load or create conversation ----
  let conversation = input.conversationId
    ? await conversationService.getById(input.businessId, input.conversationId)
    : null;

  if (!conversation) {
    if (input.channelIdentifier) {
      const result = await conversationService.findOrCreate(
        input.businessId,
        input.channel,
        input.channelIdentifier
      );
      conversation = result.conversation;
    } else {
      conversation = await conversationService.create(input.businessId, {
        channel: input.channel,
      });
    }
  }

  const conversationId = conversation.id;

  // ---- 2. Save incoming customer message ----
  await conversationService.appendMessage(conversationId, input.businessId, {
    role: "CUSTOMER",
    content: input.customerMessage,
  });

  // ---- 3. Load history + build prompt ----
  const { messages: dbMessages } = await conversationService.getWithMessages(
    input.businessId,
    conversationId,
    { messageLimit: 40 }
  );

  const systemPrompt = await buildSystemPrompt({ businessId: input.businessId });
  const aiMessages = dbMessagesToAIMessages(dbMessages);

  // ---- 4. Set up tools ----
  const aiProvider = createDefaultAIProvider();
  const toolMap = buildToolMap(SALON_TOOLS);
  const toolDefs = SALON_TOOLS.map((t) => t.definition);
  const toolContext: ToolContext = { businessId: input.businessId, conversationId, requestId };
  const toolsUsed: string[] = [];

  const toolExecutor: ToolExecutor = async (calls: AIToolCall[]) => {
    const results = [];
    for (const call of calls) {
      const tool = toolMap.get(call.name);
      toolsUsed.push(call.name);

      let result: unknown;
      if (!tool) {
        log.warn("Unknown tool called by AI", { tool: call.name });
        result = { success: false, error: `Unknown tool: ${call.name}` };
      } else {
        try {
          result = await tool.execute(call.arguments, toolContext);
        } catch (err) {
          log.error(`Tool execution failed: ${call.name}`, err);
          result = { success: false, error: `Tool ${call.name} failed. Please try another approach.` };
        }
      }

      log.info("Tool executed", {
        tool: call.name,
        success: (result as { success?: boolean })?.success ?? false,
      });

      results.push({ toolCallId: call.id, result });
    }
    return results;
  };

  // ---- 5. Call AI provider — streams final text via onChunk ----
  // Accumulate text so we can persist the full response afterwards
  let fullResponse = "";
  const wrappedOnChunk = (text: string) => {
    fullResponse += text;
    onChunk(text);
  };

  const aiResponse = await aiProvider.stream({
    messages: aiMessages,
    tools: toolDefs,
    toolExecutor,
    onChunk: wrappedOnChunk,
    systemPrompt,
    maxTokens: 1024,
    temperature: 0.7,
  });

  // ---- 6. Persist the full response ----
  await conversationService.appendMessage(conversationId, input.businessId, {
    role: "AGENT",
    content: aiResponse.message.content || fullResponse,
    aiProvider: aiResponse.provider,
    aiModel: aiResponse.model,
    inputTokens: aiResponse.usage.inputTokens,
    outputTokens: aiResponse.usage.outputTokens,
    toolCalls: aiResponse.toolCalls,
    durationMs: aiResponse.durationMs,
  });

  const updatedConversation = await conversationService.getById(
    input.businessId,
    conversationId
  );

  const durationMs = Date.now() - startMs;
  log.info("Agent stream turn complete", {
    conversationId,
    toolsUsed,
    inputTokens: aiResponse.usage.inputTokens,
    outputTokens: aiResponse.usage.outputTokens,
    durationMs,
  });

  return {
    conversationId,
    agentState: (updatedConversation.agentState as AgentState) ?? {},
    toolsUsed,
    usage: aiResponse.usage,
    durationMs,
  };
}

// ============================================================
// Helpers
// ============================================================

function dbMessagesToAIMessages(messages: Message[]): AIMessage[] {
  return messages
    .filter((m) => m.role !== "SYSTEM")
    .map((m): AIMessage => {
      if (m.role === "CUSTOMER") return { role: "user", content: m.content };
      const toolCalls = m.toolCalls as AIToolCall[] | null;
      if ((m.role === "AGENT" || m.role === "HUMAN_AGENT") && toolCalls?.length) {
        return { role: "assistant", content: "", toolCalls };
      }
      return { role: "assistant", content: m.content };
    });
}
