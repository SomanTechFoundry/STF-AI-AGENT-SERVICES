/**
 * Google Gemini AI provider — full implementation with internal tool loop.
 *
 * Gemini "thinking" models (3.x series) embed a thought_signature in every
 * function call response. If you reconstruct chat history manually across
 * separate API calls, the thought_signature is stripped and the API returns
 * a 400 error on the next tool-calling turn.
 *
 * Fix: When a toolExecutor is provided, run the ENTIRE tool-calling loop
 * inside a single ChatSession. The SDK preserves thought_signatures
 * automatically within a session's history.
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
  type Tool,
  type FunctionDeclaration,
  type Part,
} from "@google/generative-ai";

import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIMessage,
  AIToolCall,
  AIToolDefinition,
  ToolExecutor,
} from "@/lib/ai/types";
import { AppError, ErrorCode } from "@/lib/errors";
import { logger } from "@/lib/logger";

const MAX_INTERNAL_ITERATIONS = 6;

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

export class GeminiProvider implements AIProvider {
  readonly providerName = "gemini";
  readonly modelName: string;
  private readonly client: GoogleGenerativeAI;

  constructor(apiKey: string, model = "gemini-3.1-flash-lite") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = model;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startMs = Date.now();

    try {
      const tools = request.tools ? this.buildTools(request.tools) : undefined;

      const model = this.client.getGenerativeModel({
        model: this.modelName,
        systemInstruction: request.systemPrompt,
        tools,
        safetySettings: SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: request.maxTokens ?? 1024,
          temperature: request.temperature ?? 0.7,
        },
      });

      // Split messages: all but last form the history; last is the new turn
      const allMessages = request.messages.filter((m) => m.role !== "system");
      const history = allMessages.slice(0, -1);
      const lastMessage = allMessages[allMessages.length - 1];

      if (!lastMessage) {
        throw new AppError(ErrorCode.AI_PROVIDER_ERROR, "No messages provided", 400);
      }

      const geminiHistory = history.map((m) => this.toGeminiContent(m));
      const chat = model.startChat({ history: geminiHistory });
      const currentParts = this.buildCurrentParts(lastMessage);

      // ---- If toolExecutor provided: run full loop inside one session ----
      if (request.toolExecutor && request.tools?.length) {
        return await this.runToolLoop(
          chat,
          currentParts,
          request.toolExecutor,
          startMs
        );
      }

      // ---- Single-turn: just one call, no tool execution ----
      const result = await chat.sendMessage(currentParts);
      const response = result.response;
      const usage = response.usageMetadata;
      const durationMs = Date.now() - startMs;

      const functionCalls = response.functionCalls();
      if (functionCalls?.length) {
        const toolCalls: AIToolCall[] = functionCalls.map((fc, i) => ({
          id: `${fc.name}-${i}-${Date.now()}`,
          name: fc.name,
          arguments: fc.args as Record<string, unknown>,
        }));

        return {
          message: { role: "assistant", content: "", toolCalls },
          toolCalls,
          usage: {
            inputTokens: usage?.promptTokenCount ?? 0,
            outputTokens: usage?.candidatesTokenCount ?? 0,
          },
          stopReason: "tool_calls",
          provider: this.providerName,
          model: this.modelName,
          durationMs,
        };
      }

      return {
        message: { role: "assistant", content: response.text() },
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        },
        stopReason: "stop",
        provider: this.providerName,
        model: this.modelName,
        durationMs,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error("Gemini API error", err);
      throw new AppError(
        ErrorCode.AI_PROVIDER_ERROR,
        "The AI service is temporarily unavailable. Please try again.",
        502,
        { cause: err instanceof Error ? err : undefined }
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent("ping");
      return !!result.response.text();
    } catch {
      return false;
    }
  }

  // ============================================================
  // Internal tool loop — runs entirely within one ChatSession
  // so thought_signatures are preserved automatically by the SDK
  // ============================================================

  private async runToolLoop(
    chat: ReturnType<ReturnType<GoogleGenerativeAI["getGenerativeModel"]>["startChat"]>,
    initialParts: Part[],
    toolExecutor: ToolExecutor,
    startMs: number
  ): Promise<AICompletionResponse> {
    let parts: Part[] = initialParts;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const allToolCalls: AIToolCall[] = [];

    for (let i = 0; i < MAX_INTERNAL_ITERATIONS; i++) {
      const result = await chat.sendMessage(parts);
      const response = result.response;
      const usage = response.usageMetadata;
      totalInputTokens += usage?.promptTokenCount ?? 0;
      totalOutputTokens += usage?.candidatesTokenCount ?? 0;

      const functionCalls = response.functionCalls();

      // No more tool calls — this is the final text response
      if (!functionCalls || functionCalls.length === 0) {
        return {
          message: { role: "assistant", content: response.text() },
          toolCalls: allToolCalls.length ? allToolCalls : undefined,
          usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
          stopReason: "stop",
          provider: this.providerName,
          model: this.modelName,
          durationMs: Date.now() - startMs,
        };
      }

      // Map Gemini function calls to our typed AIToolCall format
      const typedCalls: AIToolCall[] = functionCalls.map((fc, idx) => ({
        id: `${fc.name}-${i}-${idx}-${Date.now()}`,
        name: fc.name,
        arguments: fc.args as Record<string, unknown>,
      }));
      allToolCalls.push(...typedCalls);

      // Execute tools via the provided callback
      const toolResults = await toolExecutor(typedCalls);

      // Build function response parts to send back in the SAME session
      // The SDK retains thought_signatures in its internal history
      parts = toolResults.map((tr) => {
        // Find the original call to get the Gemini function name
        const call = typedCalls.find((c) => c.id === tr.toolCallId) ?? typedCalls[0];
        return {
          functionResponse: {
            name: call.name,
            response: { result: tr.result },
          },
        } as Part;
      });
    }

    // Fallback if we somehow exhausted iterations
    return {
      message: {
        role: "assistant",
        content: "I've gathered the information needed. How else can I help you?",
      },
      toolCalls: allToolCalls.length ? allToolCalls : undefined,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      stopReason: "max_tokens",
      provider: this.providerName,
      model: this.modelName,
      durationMs: Date.now() - startMs,
    };
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private toGeminiContent(message: AIMessage): Content {
    if (message.role === "assistant") {
      if (message.toolCalls?.length) {
        return {
          role: "model",
          parts: message.toolCalls.map((tc) => ({
            functionCall: { name: tc.name, args: tc.arguments },
          })),
        };
      }
      return { role: "model", parts: [{ text: message.content }] };
    }
    if (message.role === "tool") {
      return {
        role: "function",
        parts: [
          {
            functionResponse: {
              name: message.toolCallId ?? "tool_result",
              response: { result: message.content },
            },
          },
        ],
      };
    }
    return { role: "user", parts: [{ text: message.content }] };
  }

  private buildCurrentParts(message: AIMessage): Part[] {
    return [{ text: message.content || "Please continue." }];
  }

  private buildTools(toolDefs: AIToolDefinition[]): Tool[] {
    const functionDeclarations: FunctionDeclaration[] = toolDefs.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: "object" as const,
        properties: t.parameters.properties as Record<string, unknown>,
        required: t.parameters.required ?? [],
      },
    }));
    return [{ functionDeclarations }];
  }
}
