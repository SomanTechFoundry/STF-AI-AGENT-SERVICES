/**
 * Customer management tools.
 * Used by the agent to identify and create customers during conversations.
 */

import { z } from "zod";
import { customerService } from "@/lib/services/customer.service";
import { conversationService } from "@/lib/services/conversation.service";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/utils/id";
import type { AgentTool, ToolContext } from "./types";
import { toolSuccess, toolError } from "./types";

// ============================================================
// findOrCreateCustomer
// ============================================================

const findOrCreateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  // Do NOT default to false here — Zod .default(false) made smsOptIn always
  // defined, which blocked the "opt in when phone is provided" fallback.
  smsOptIn: z.boolean().optional(),
});

export const findOrCreateCustomerTool: AgentTool = {
  definition: {
    name: "findOrCreateCustomer",
    description:
      "Find an existing customer by phone or email, or create a new one if they don't exist. " +
      "Call this once you have collected the customer's phone number or email address. " +
      "At least one of phone or email is required. Name is helpful but optional. " +
      "When a phone number is provided, SMS confirmation opt-in is automatic — do not pass smsOptIn unless the customer explicitly declines SMS.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Customer's full name",
        },
        phone: {
          type: "string",
          description: "Customer's phone number (any format accepted)",
        },
        email: {
          type: "string",
          description: "Customer's email address",
        },
        smsOptIn: {
          type: "boolean",
          description:
            "Only set this to false if the customer explicitly declines SMS confirmations. " +
            "Otherwise omit it — providing a phone number opts them in automatically.",
        },
      },
      required: [],
    },
  },

  async execute(args: unknown, context: ToolContext) {
    const parsed = findOrCreateSchema.safeParse(args ?? {});

    if (!parsed.success) {
      return toolError("Please provide at least a phone number or email to look up the customer.");
    }

    const { name, phone, email, smsOptIn } = parsed.data;

    if (!phone && !email) {
      return toolError(
        "I need either a phone number or email address to look up or create the customer record."
      );
    }

    // Validate phone normalization
    if (phone) {
      const normalized = normalizePhone(phone);
      if (!normalized) {
        return toolError(
          `The phone number "${phone}" doesn't look valid. Please ask the customer to confirm their number (e.g. 214-555-1234).`
        );
      }
    }

    try {
      // Providing a phone in chat = consent for booking SMS confirmations.
      // Only an explicit smsOptIn:false from the AI overrides that.
      const resolvedSmsOptIn = smsOptIn === false ? false : !!phone;

      const { customer, created } = await customerService.findOrCreate(
        context.businessId,
        {
          name: name ?? null,
          phone: phone ?? null,
          email: email ?? null,
          smsOptIn: resolvedSmsOptIn,
          emailOptIn: !!email,
          preferredChannel: "SMS",
        }
      );

      // Link the customer to this conversation
      await conversationService.linkCustomer(context.conversationId, customer.id);

      // Update agent state with customer info
      await conversationService.updateAgentState(context.conversationId, {
        customerId: customer.id,
        customerName: customer.name ?? undefined,
        customerPhone: customer.phone ?? undefined,
        customerEmail: customer.email ?? undefined,
      });

      logger.info("Customer identified in conversation", {
        businessId: context.businessId,
        conversationId: context.conversationId,
        customerId: customer.id,
        created,
      });

      return toolSuccess({
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        isNewCustomer: created,
        message: created
          ? "New customer profile created."
          : "Welcome back! Found existing customer profile.",
      });
    } catch (err) {
      logger.error("findOrCreateCustomer tool error", err, {
        businessId: context.businessId,
        conversationId: context.conversationId,
      });
      return toolError("Unable to look up customer information at this time.");
    }
  },
};
