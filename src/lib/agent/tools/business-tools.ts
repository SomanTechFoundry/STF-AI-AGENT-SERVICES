/**
 * Business information tools.
 * These allow the AI to look up business details, services, hours, and FAQs.
 * All queries are scoped to the businessId from ToolContext.
 */

import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { businessHoursService } from "@/lib/services/business-hours.service";
import { serviceService } from "@/lib/services/service.service";
import { logger } from "@/lib/logger";
import type { AgentTool, ToolContext } from "./types";
import { toolSuccess, toolError } from "./types";

// ============================================================
// getBusinessInfo
// ============================================================

export const getBusinessInfoTool: AgentTool = {
  definition: {
    name: "getBusinessInfo",
    description:
      "Get general information about this business: name, address, phone, website, and policies. " +
      "Call this when the customer asks where the business is located, what the phone number is, " +
      "or general questions about the business.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  async execute(_args: unknown, context: ToolContext) {
    try {
      const business = await prisma.business.findUnique({
        where: { id: context.businessId },
        select: {
          name: true,
          phone: true,
          email: true,
          website: true,
          address: true,
          city: true,
          state: true,
          postalCode: true,
          timezone: true,
          cancellationPolicyHours: true,
          bookingLeadTimeMinutes: true,
          bookingMaxDaysAhead: true,
        },
      });

      if (!business) return toolError("Business information not available.");

      return toolSuccess({
        name: business.name,
        phone: business.phone,
        email: business.email,
        website: business.website,
        address: [business.address, business.city, business.state, business.postalCode]
          .filter(Boolean)
          .join(", "),
        timezone: business.timezone,
        cancellationPolicy: `${business.cancellationPolicyHours} hours notice required for cancellations`,
        bookingPolicy: `Appointments can be booked up to ${business.bookingMaxDaysAhead} days in advance`,
      });
    } catch (err) {
      logger.error("getBusinessInfo tool error", err, { businessId: context.businessId });
      return toolError("Unable to retrieve business information at this time.");
    }
  },
};

// ============================================================
// getServices
// ============================================================

export const getServicesTool: AgentTool = {
  definition: {
    name: "getServices",
    description:
      "Get the list of all available services with their names, prices, and durations. " +
      "Call this when the customer asks what services are offered, what the prices are, " +
      "or wants to browse available options.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional: filter services by category (e.g. 'Hair', 'Color', 'Treatment')",
        },
      },
      required: [],
    },
  },

  async execute(args: unknown, context: ToolContext) {
    const { category } = z.object({ category: z.string().optional() }).parse(args ?? {});

    try {
      const services = await serviceService.list(context.businessId, true);

      const filtered = category
        ? services.filter((s) =>
            s.category?.toLowerCase() === category.toLowerCase()
          )
        : services;

      if (filtered.length === 0) {
        return toolSuccess({ services: [], message: "No services found." });
      }

      return toolSuccess({
        services: filtered.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          price: Number(s.price),
          currency: s.currency,
          category: s.category,
        })),
      });
    } catch (err) {
      logger.error("getServices tool error", err, { businessId: context.businessId });
      return toolError("Unable to retrieve services at this time.");
    }
  },
};

// ============================================================
// getServiceDetails
// ============================================================

export const getServiceDetailsTool: AgentTool = {
  definition: {
    name: "getServiceDetails",
    description:
      "Get detailed information about a specific service by name. " +
      "Call this when the customer asks about a specific service.",
    parameters: {
      type: "object",
      properties: {
        serviceName: {
          type: "string",
          description: "The name of the service to look up",
        },
      },
      required: ["serviceName"],
    },
  },

  async execute(args: unknown, context: ToolContext) {
    const { serviceName } = z
      .object({ serviceName: z.string().min(1) })
      .parse(args ?? {});

    try {
      const service = await serviceService.findByName(context.businessId, serviceName);

      if (!service) {
        return toolError(
          `I couldn't find a service called "${serviceName}". Please call getServices to see all available options.`
        );
      }

      return toolSuccess({
        id: service.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        price: Number(service.price),
        currency: service.currency,
        category: service.category,
        bufferMinutes: service.bufferMinutes,
      });
    } catch (err) {
      logger.error("getServiceDetails tool error", err, { businessId: context.businessId });
      return toolError("Unable to retrieve service details at this time.");
    }
  },
};

// ============================================================
// getBusinessHours
// ============================================================

export const getBusinessHoursTool: AgentTool = {
  definition: {
    name: "getBusinessHours",
    description:
      "Get the business hours / weekly schedule. " +
      "Call this when the customer asks what time you open/close, " +
      "whether you are open on a specific day, or your hours of operation.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  async execute(_args: unknown, context: ToolContext) {
    try {
      const schedule = await businessHoursService.getFormattedSchedule(
        context.businessId
      );

      return toolSuccess({ schedule });
    } catch (err) {
      logger.error("getBusinessHours tool error", err, { businessId: context.businessId });
      return toolError("Unable to retrieve business hours at this time.");
    }
  },
};

// ============================================================
// getFAQs
// ============================================================

export const getFAQsTool: AgentTool = {
  definition: {
    name: "getFAQs",
    description:
      "Get answers to frequently asked questions and business policies. " +
      "Call this when the customer asks a general question about the business " +
      "that might be answered by a FAQ (parking, payment, cancellation, etc.).",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Optional: 'faq', 'policy', or 'service_info'",
        },
      },
      required: [],
    },
  },

  async execute(args: unknown, context: ToolContext) {
    const { category } = z.object({ category: z.string().optional() }).parse(args ?? {});

    try {
      const items = await prisma.knowledgeItem.findMany({
        where: {
          businessId: context.businessId,
          isActive: true,
          ...(category && { category }),
        },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
        take: 20,
      });

      return toolSuccess({
        items: items.map((item) => ({
          question: item.question,
          answer: item.answer,
          category: item.category,
        })),
      });
    } catch (err) {
      logger.error("getFAQs tool error", err, { businessId: context.businessId });
      return toolError("Unable to retrieve FAQ information at this time.");
    }
  },
};
