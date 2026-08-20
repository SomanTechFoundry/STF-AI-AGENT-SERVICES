/**
 * Booking tools — real appointment availability and creation.
 *
 * Phase 4: Full implementations backed by AppointmentService.
 * - checkAvailability: queries real business hours + existing appointments
 * - createAppointment: creates DB record with conflict detection and idempotency
 */

import { z } from "zod";
import { conversationService } from "@/lib/services/conversation.service";
import { serviceService } from "@/lib/services/service.service";
import { staffService } from "@/lib/services/staff.service";
import { appointmentService } from "@/lib/services/appointment.service";
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
        "To check availability I need the service name and a date (e.g. 2025-01-15)."
      );
    }

    const { serviceName, date, staffName } = parsed.data;

    try {
      // Resolve service
      const service = await serviceService.findByName(context.businessId, serviceName);
      if (!service) {
        return toolError(
          `I couldn't find a service called "${serviceName}". Please confirm the service name.`
        );
      }

      // Resolve preferred staff (optional)
      let preferredStaffId: string | undefined;
      if (staffName) {
        const allStaff = await staffService.getByService(context.businessId, service.id);
        const matched = allStaff.find(
          (s) => s.name.toLowerCase() === staffName.toLowerCase()
        );
        if (!matched) {
          return toolError(
            `I couldn't find a staff member named "${staffName}" for that service. Would you like to see who's available?`
          );
        }
        preferredStaffId = matched.id;
      }

      // Real availability check
      const availability = await appointmentService.checkAvailability(
        context.businessId,
        service.id,
        date,
        preferredStaffId
      );

      // Save booking progress to conversation state
      await conversationService.updateAgentState(context.conversationId, {
        requestedService: serviceName,
        requestedServiceId: service.id,
        requestedDate: date,
        requestedStaffId: preferredStaffId,
        bookingStatus: "checking_availability",
      });

      logger.info("checkAvailability executed", {
        businessId: context.businessId,
        conversationId: context.conversationId,
        serviceName,
        date,
        slotsFound: availability.slots.length,
      });

      if (!availability.isOpen) {
        return toolSuccess({
          available: false,
          message: availability.message ?? "We are not available on that date.",
        });
      }

      if (availability.slots.length === 0) {
        return toolSuccess({
          available: false,
          service: availability.service.name,
          date,
          message: availability.message ?? "No available slots on that date. Please try another day.",
        });
      }

      // Deduplicate slots to just times (multiple staff could offer the same time)
      const uniqueTimes = [...new Set(availability.slots.map((s) => s.time))];

      return toolSuccess({
        available: true,
        service: availability.service.name,
        date,
        durationMinutes: availability.service.durationMinutes,
        price: availability.service.price,
        currency: availability.service.currency,
        timezone: availability.timezone,
        availableSlots: uniqueTimes,
      });
    } catch (err) {
      logger.error("checkAvailability tool error", err, { businessId: context.businessId });
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
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM in 24-hour format"),
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
      "(3) the customer has explicitly confirmed all booking details.",
    parameters: {
      type: "object",
      properties: {
        serviceName: {
          type: "string",
          description: "The service to book",
        },
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format (in business local time)",
        },
        time: {
          type: "string",
          description: "Time in HH:MM 24-hour format (e.g. '14:00') in business local time",
        },
        customerId: {
          type: "string",
          description: "The customer ID returned by findOrCreateCustomer",
        },
        staffName: {
          type: "string",
          description: "Optional: preferred staff member name",
        },
        notes: {
          type: "string",
          description: "Optional: any special requests or notes for the appointment",
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

    const { serviceName, date, time, customerId, staffName, notes } = parsed.data;

    try {
      // Resolve service
      const service = await serviceService.findByName(context.businessId, serviceName);
      if (!service) {
        return toolError(`Service "${serviceName}" not found. Please confirm the service name.`);
      }

      // Resolve preferred staff (optional)
      let staffId: string | undefined;
      if (staffName) {
        const allStaff = await staffService.getByService(context.businessId, service.id);
        const matched = allStaff.find(
          (s) => s.name.toLowerCase() === staffName.toLowerCase()
        );
        if (matched) staffId = matched.id;
      }

      // Generate idempotency key so retries don't create duplicates
      const idempotencyKey = `conv:${context.conversationId}:${service.id}:${date}:${time}`;

      // Create the real appointment
      const appointment = await appointmentService.createAppointment(
        context.businessId,
        {
          customerId,
          serviceId: service.id,
          staffId,
          date,
          time,
          notes,
          conversationId: context.conversationId,
          idempotencyKey,
        }
      );

      // Update conversation state
      await conversationService.updateAgentState(context.conversationId, {
        bookingStatus: "booked",
        requestedService: serviceName,
        requestedServiceId: service.id,
        requestedDate: date,
        requestedTime: time,
        customerId,
        appointmentId: appointment.id,
      });

      logger.info("createAppointment executed", {
        businessId: context.businessId,
        conversationId: context.conversationId,
        appointmentId: appointment.id,
        serviceName,
        date,
        time,
        customerId,
      });

      return toolSuccess({
        appointmentId: appointment.id,
        service: service.name,
        date,
        time,
        durationMinutes: service.durationMinutes,
        price: Number(service.price),
        currency: service.currency,
        notes: notes ?? null,
        status: appointment.status,
        message: "Appointment booked successfully!",
      });
    } catch (err) {
      // Surface slot-conflict errors to the AI so it can ask for another time
      if (err instanceof Error && err.message.includes("no longer available")) {
        return toolError(err.message);
      }
      logger.error("createAppointment tool error", err, { businessId: context.businessId });
      return toolError(
        "I was unable to complete the booking at this time. Please call us directly to book your appointment."
      );
    }
  },
};
