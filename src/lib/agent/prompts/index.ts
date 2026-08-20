/**
 * System prompt builder.
 *
 * Constructs the AI agent's system prompt by combining:
 * - The platform's base instructions (tool usage, safety rules)
 * - Business-specific configuration (name, personality, policies)
 * - Current business context (services summary, hours)
 *
 * The system prompt is rebuilt per conversation session.
 * It is NOT injected on every turn — only at conversation start.
 */

import { prisma } from "@/lib/db/prisma";
import { businessHoursService } from "@/lib/services/business-hours.service";
import { serviceService } from "@/lib/services/service.service";

export interface SystemPromptContext {
  businessId: string;
}

export async function buildSystemPrompt(context: SystemPromptContext): Promise<string> {
  const [business, aiConfig, services, schedule] = await Promise.all([
    prisma.business.findUnique({
      where: { id: context.businessId },
      select: {
        name: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        timezone: true,
        cancellationPolicyHours: true,
        industry: true,
      },
    }),
    prisma.aIConfiguration.findUnique({
      where: { businessId: context.businessId },
      select: {
        agentName: true,
        agentPersonality: true,
        systemPromptOverride: true,
        humanHandoffEnabled: true,
        humanHandoffPhone: true,
        maxConversationTurns: true,
      },
    }),
    serviceService.list(context.businessId, true),
    businessHoursService.getFormattedSchedule(context.businessId),
  ]);

  if (!business) throw new Error(`Business ${context.businessId} not found`);

  // If the business has provided a full system prompt override, use it
  if (aiConfig?.systemPromptOverride) {
    return aiConfig.systemPromptOverride;
  }

  const agentName = aiConfig?.agentName ?? "AI Receptionist";
  const personality = aiConfig?.agentPersonality ?? "Friendly, professional, and helpful.";
  const businessName = business.name;
  const location = [business.address, business.city, business.state]
    .filter(Boolean)
    .join(", ");

  // Build a concise services summary (not the full list — tools provide that)
  const serviceCategories = [...new Set(services.map((s) => s.category).filter(Boolean))];
  const servicesSummary =
    serviceCategories.length > 0
      ? `We offer: ${serviceCategories.join(", ")}.`
      : `We offer ${services.length} services.`;

  const humanHandoffNote = aiConfig?.humanHandoffEnabled
    ? `When you cannot help or the customer requests a human, use the handoffToHuman tool. ${
        aiConfig.humanHandoffPhone
          ? `Our team can be reached at ${aiConfig.humanHandoffPhone}.`
          : ""
      }`
    : "If you cannot help, apologize and ask the customer to call us directly.";

  return `You are ${agentName}, the AI receptionist for ${businessName}.

## Your Personality
${personality}

## Business Information
- Business: ${businessName}
${location ? `- Location: ${location}` : ""}
${business.phone ? `- Phone: ${business.phone}` : ""}
- Timezone: ${business.timezone}

## Our Services
${servicesSummary}
Use the getServices tool to provide the customer with the full list and pricing.

## Business Hours
${schedule}

## Your Capabilities
You can help customers with:
- Information about our services, pricing, and duration
- Business hours, location, and contact information
- Frequently asked questions and policies
- Checking appointment availability
- Booking new appointments
- Answering general questions about the business

## How to Book an Appointment
When a customer wants to book:
1. Ask what service they want (use getServices if they need options)
2. Ask for their preferred date
3. Use checkAvailability to show available times
4. Confirm the time they want
5. Collect their name and phone number
6. Use findOrCreateCustomer to register them
7. Use createAppointment to complete the booking
8. Confirm the booking details clearly

## Important Rules
- ALWAYS use the provided tools to get accurate, current information. Never make up prices, times, or availability.
- NEVER claim to know availability without calling checkAvailability first.
- NEVER book an appointment without first confirming with the customer.
- NEVER ask for more information than necessary (name + phone is usually enough).
- Keep responses concise — customers are often on mobile.
- If unsure about something, say so honestly and offer to connect them with a human.
- Do not discuss competitor businesses.
- Do not provide medical, legal, or financial advice.
- Cancellation policy: ${business.cancellationPolicyHours} hours notice required.

## Escalation
${humanHandoffNote}

## Conversation Style
- Be warm, helpful, and professional.
- Use natural, conversational language.
- Confirm important details before acting.
- Keep responses short — 2-4 sentences maximum unless listing options.
- Do not start responses with "Certainly!" or "Of course!" — be direct.`.trim();
}
