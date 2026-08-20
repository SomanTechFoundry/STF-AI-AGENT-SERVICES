/**
 * POST /api/agent/chat
 *
 * The primary entry point for customer messages to the AI agent.
 *
 * Request body:
 * {
 *   businessId: string;         // Which business's agent to use
 *   message: string;            // The customer's message
 *   conversationId?: string;    // Resume an existing conversation
 *   channel?: string;           // "WEBCHAT" | "SMS" | "VOICE" (default: WEBCHAT)
 *   channelIdentifier?: string; // Phone number for SMS, session ID for webchat
 * }
 *
 * Response:
 * {
 *   data: {
 *     conversationId: string;
 *     response: string;         // The agent's reply to show to the customer
 *     toolsUsed: string[];
 *     usage: { inputTokens, outputTokens };
 *     durationMs: number;
 *   }
 * }
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/agent";
import { parseBody } from "@/lib/validation";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { generateRequestId } from "@/lib/utils/id";
import { logger } from "@/lib/logger";
import type { ConversationChannel } from "@prisma/client";

const chatRequestSchema = z.object({
  businessId: z.string().min(1, "businessId is required"),
  message: z.string().min(1, "message cannot be empty").max(4000, "message too long"),
  conversationId: z.string().optional(),
  channel: z
    .enum(["WEBCHAT", "SMS", "VOICE", "EMAIL", "WHATSAPP"])
    .default("WEBCHAT"),
  channelIdentifier: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const body = await request.json();
    const input = parseBody(chatRequestSchema, body);

    logger.info("Agent chat request", {
      requestId,
      businessId: input.businessId,
      channel: input.channel,
      conversationId: input.conversationId,
    });

    const result = await runAgent({
      businessId: input.businessId,
      conversationId: input.conversationId,
      channel: input.channel as ConversationChannel,
      channelIdentifier: input.channelIdentifier,
      customerMessage: input.message,
    });

    return successResponse(result, 200, { requestId });
  } catch (err) {
    return errorResponse(err, { requestId });
  }
}
