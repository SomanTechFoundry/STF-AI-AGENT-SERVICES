/**
 * Booking tools — appointment availability and creation.
 *
 * Phase 3: Structured stubs that allow full agent conversations.
 * The AI can collect all required information and attempt to book.
 * Phase 4: These implementations will be replaced with real
 *           Google Calendar + database appointment creation.
 */

import { z } from "zod";
import { conversationService } from "@/lib/services/conversation.service";
import { serviceService } from "@/lib/services/service.service";
import { staffService } from "@/lib/services/staff.service";
import { logger } from "@/lib/logger";
import type { AgentTool, ToolContext } from "./types";
import { toolSuccess, toolError } from "./types";

// ============================================================
// checkAvailability
// ============================================================

const checkAvailabilitySchema = z.object({
  serviceName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  staffName: z.string().optional(),
});

export const checkAvailabilityTool: AgentTool = {
  definition: {
    name: "checkAvailability",
    description:
      "Check available appointment slots for a service on a specific date. " +
      "Call this when the customer has chosen a service and a date, and wants to know " +
      "what times are available. Returns a list of available time slots.",
    parameters: {
      type: "object",
      properties: {
        serviceName: {
          type: "string",
          description: "The name of the service to book",
        },
        date: {
          type: "string",
          description: "The requested date in YYYY-MM-DD format",
        },
        staffName: {
          type: "string",
          description: "Optional: preferred staff member name",
        },
      },
      required: ["serviceName", "date"],
    },
  },

  async execute(args: unknown, context: ToolContext) {
    const parsed = checkAvailabilitySchema.safeParse(args ?? {});
    if (!parsed.success) {
      return toolError(
        "To check availability I need the service name and a date (e.g. 2024-01-15)."
      );
    }

    const { serviceName, date, staffName } = parsed.data;

    try {
      // Validate the service exists for this business
      const service = await serviceService.findByName(context.businessId, serviceName);
      if (!service) {
        return toolError(
          `I couldn't find a service called "${serviceName}". Please confirm the service name.`
        );
      }

      // Validate staff if requested
      let staffId: string | undefined;
      if (staffName) {
        const allStaff = await staffService.getByService(context.businessId, service.id);
        const matchedStaff = allStaff.find(
          (s) => s.name.toLowerCase() === staffName.toLowerCase()
        );
        if (!matchedStaff) {
          return toolError(
            `I couldn't find a staff member named "${staffName}" for that service. Would you like to see who's available?`
          );
        }
        staffId = matchedStaff.id;
      }

      // Update agent state with booking progress
      await conversationService.updateAgentState(context.conversationId, {
        requestedService: serviceName,
        requestedServiceId: service.id,
        requestedDate: date,
        requestedStaffId: staffId,
        bookingStatus: "checking_availability",
      });

      // Phase 3 stub — Phase 4 will query real calendar slots
      // Return realistic-looking mock slots so the agent can complete the conversation flow
      const mockSlots = generateMockSlots(date, service.durationMinutes);

      logger.info("checkAvailability called (Phase 3 stub)", {
        businessId: context.businessId,
        conversationId: context.conversationId,
        serviceName,
        date,
      });

      return toolSuccess({
        service: service.name,
        date,
        durationMinutes: service.durationMinutes,
        availableSlots: mockSlots,
        note: "Calendar integration will be enabled in Phase 4. These are placeholder slots.",
      });
    } catch (err) {
      logger.error("checkAvailability tool error", err, {
        businessId: context.businessId,
      });
      return toolError("Unable to check availability at this time. Please call us directly.");
    }
  },
};

// ============================================================
// createAppointment
// ============================================================

const createAppointmentSchema = z.object({
  serviceName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  customerId: z.string().min(1),
  staffName: z.string().optional(),
  notes: z.string().optional(),
});

export const createAppointmentTool: AgentTool = {
  definition: {
    name: "createAppointment",
    description:
      "Book an appointment after the customer has confirmed the service, date, time, and their contact information. " +
      "Only call this after: (1) customer identity is confirmed via findOrCreateCustomer, " +
      "(2) availability has been checked via checkAvailability, " +
      "(3) the customer has explicitly confirmed the booking details.",
    parameters: {
      type: "object",
      properties: {
        serviceName: {
          type: "string",
          description: "The service to book",
        },
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format",
        },
        time: {
          type: "string",
          description: "Time in HH:MM 24-hour format (e.g. '14:00')",
        },
        customerId: {
          type: "string",
          description: "The customer ID from findOrCreateCustomer",
        },
        staffName: {
          type: "string",
          description: "Optional: preferred staff member",
        },
        notes: {
          type: "string",
          description: "Optional: any special notes for the appointment",
        },
      },
      required: ["serviceName", "date", "time", "customerId"],
    },
  },

  async execute(args: unknown, context: ToolContext) {
    const parsed = createAppointmentSchema.safeParse(args ?? {});
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      return toolError(
        `To book the appointment I still need: ${fields}. Please collect this information from the customer.`
      );
    }

    const { serviceName, date, time, customerId, notes } = parsed.data;

    try {
      const service = await serviceService.findByName(context.businessId, serviceName);
      if (!service) {
        return toolError(`Service "${serviceName}" not found. Please confirm the service name.`);
      }

      // Phase 3 stub — Phase 4 will create real DB appointment + Google Calendar event
      const mockConfirmationNumber = `APT-${Date.now().toString(36).toUpperCase()}`;

      await conversationService.updateAgentState(context.conversationId, {
        bookingStatus: "booked",
        requestedService: serviceName,
        requestedServiceId: service.id,
        requestedDate: date,
        requestedTime: time,
        customerId,
        appointmentId: mockConfirmationNumber,
      });

      logger.info("createAppointment called (Phase 3 stub)", {
        businessId: context.businessId,
        conversationId: context.conversationId,
        serviceName,
        date,
        time,
        customerId,
      });

      return toolSuccess({
        confirmationNumber: mockConfirmationNumber,
        service: service.name,
        date,
        time,
        durationMinutes: service.durationMinutes,
        price: Number(service.price),
        currency: service.currency,
        notes: notes ?? null,
        message:
          "Appointment booked successfully! Note: Calendar integration (Phase 4) will enable " +
          "real booking, reminders, and calendar sync.",
      });
    } catch (err) {
      logger.error("createAppointment tool error", err, {
        businessId: context.businessId,
      });
      return toolError(
        "I was unable to complete the booking at this time. Please call us directly to book your appointment."
      );
    }
  },
};

// ============================================================
// Helper
// ============================================================

function generateMockSlots(date: string, _durationMinutes: number): string[] {
  // Generate reasonable-looking available slots
  const slots = ["09:00", "09:30", "10:00", "10:30", "11:00",
                  "13:00", "13:30", "14:00", "14:30", "15:00", "16:00"];

  // Pseudo-randomly remove some slots based on the date to look realistic
  const dateNum = parseInt(date.replace(/-/g, ""), 10);
  return slots.filter((_, i) => (dateNum + i) % 3 !== 0);
}
