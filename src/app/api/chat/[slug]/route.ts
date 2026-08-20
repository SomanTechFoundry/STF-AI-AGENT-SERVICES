/**
 * GET /api/chat/[slug]
 *
 * Public endpoint — no API key required.
 * Returns the minimal business info the chat widget needs to initialise:
 * businessId, name, agent name, and welcome message.
 */

import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { NotFoundError } from "@/lib/errors";
import { generateRequestId } from "@/lib/utils/id";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const requestId = generateRequestId();
  try {
    const { slug } = await params;

    const business = await prisma.business.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        status: true,
        phone: true,
        city: true,
        state: true,
        aiConfiguration: {
          select: {
            agentName: true,
            welcomeMessage: true,
          },
        },
      },
    });

    if (!business || business.status === "SUSPENDED" || business.status === "CANCELLED") {
      throw new NotFoundError("Business", slug);
    }

    return successResponse(
      {
        businessId: business.id,
        name: business.name,
        phone: business.phone,
        location: business.city && business.state ? `${business.city}, ${business.state}` : null,
        agentName: business.aiConfiguration?.agentName ?? "AI Assistant",
        welcomeMessage:
          business.aiConfiguration?.welcomeMessage ??
          `Hi! I'm the AI assistant for ${business.name}. How can I help you today?`,
      },
      200,
      { requestId }
    );
  } catch (err) {
    return errorResponse(err, { requestId });
  }
}
