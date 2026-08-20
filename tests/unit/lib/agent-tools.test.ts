/**
 * Agent tool unit tests.
 * Tests tool input validation and error handling without real DB calls.
 */

import { toolSuccess, toolError } from "@/lib/agent/tools/types";
import { checkAvailabilityTool } from "@/lib/agent/tools/booking-tools";
import { handoffToHumanTool } from "@/lib/agent/tools/escalation-tools";
import { SALON_TOOLS, buildToolMap } from "@/lib/agent/tools";

// Mock all external dependencies
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    business: { findUnique: jest.fn() },
    knowledgeItem: { findMany: jest.fn() },
    conversation: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    usageRecord: { create: jest.fn() },
    message: { create: jest.fn() },
  },
}));

jest.mock("@/lib/services/service.service", () => ({
  serviceService: {
    list: jest.fn(),
    findByName: jest.fn(),
  },
}));

jest.mock("@/lib/services/staff.service", () => ({
  staffService: {
    getByService: jest.fn(),
  },
}));

jest.mock("@/lib/services/conversation.service", () => ({
  conversationService: {
    updateAgentState: jest.fn().mockResolvedValue(undefined),
    linkCustomer: jest.fn().mockResolvedValue(undefined),
    escalate: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/services/business-hours.service", () => ({
  businessHoursService: {
    getFormattedSchedule: jest.fn(),
  },
}));

const mockContext = {
  businessId: "biz-test-123",
  conversationId: "conv-test-456",
  requestId: "req-test-789",
};

// ============================================================
// toolSuccess / toolError helpers
// ============================================================

describe("tool result helpers", () => {
  it("toolSuccess wraps data correctly", () => {
    const result = toolSuccess({ foo: "bar" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ foo: "bar" });
  });

  it("toolError wraps message correctly", () => {
    const result = toolError("Something went wrong");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Something went wrong");
  });
});

// ============================================================
// Tool registry
// ============================================================

describe("SALON_TOOLS registry", () => {
  it("contains all expected tools", () => {
    const names = SALON_TOOLS.map((t) => t.definition.name);
    expect(names).toContain("getBusinessInfo");
    expect(names).toContain("getServices");
    expect(names).toContain("getServiceDetails");
    expect(names).toContain("getBusinessHours");
    expect(names).toContain("getFAQs");
    expect(names).toContain("findOrCreateCustomer");
    expect(names).toContain("checkAvailability");
    expect(names).toContain("createAppointment");
    expect(names).toContain("handoffToHuman");
  });

  it("buildToolMap creates a map with all tools", () => {
    const map = buildToolMap(SALON_TOOLS);
    expect(map.size).toBe(SALON_TOOLS.length);
    expect(map.has("checkAvailability")).toBe(true);
    expect(map.has("handoffToHuman")).toBe(true);
  });

  it("every tool has a name and description", () => {
    for (const tool of SALON_TOOLS) {
      expect(tool.definition.name).toBeTruthy();
      expect(tool.definition.description.length).toBeGreaterThan(20);
      expect(tool.definition.parameters.type).toBe("object");
    }
  });
});

// ============================================================
// checkAvailability
// ============================================================

describe("checkAvailabilityTool", () => {
  const { serviceService } = require("@/lib/services/service.service");

  beforeEach(() => {
    serviceService.findByName.mockResolvedValue({
      id: "svc-1",
      name: "Women's Haircut",
      durationMinutes: 60,
      price: 65,
      currency: "USD",
    });
  });

  it("returns available slots for valid input", async () => {
    const result = await checkAvailabilityTool.execute(
      { serviceName: "Women's Haircut", date: "2024-06-15" },
      mockContext
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.availableSlots.length).toBeGreaterThan(0);
      expect(result.data.service).toBe("Women's Haircut");
    }
  });

  it("returns error for invalid date format", async () => {
    const result = await checkAvailabilityTool.execute(
      { serviceName: "Women's Haircut", date: "June 15" },
      mockContext
    );
    expect(result.success).toBe(false);
  });

  it("returns error when service not found", async () => {
    serviceService.findByName.mockResolvedValue(null);
    const result = await checkAvailabilityTool.execute(
      { serviceName: "Nonexistent Service", date: "2024-06-15" },
      mockContext
    );
    expect(result.success).toBe(false);
  });

  it("returns error for missing required args", async () => {
    const result = await checkAvailabilityTool.execute({}, mockContext);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// handoffToHuman
// ============================================================

describe("handoffToHumanTool", () => {
  const { prisma } = require("@/lib/db/prisma");

  beforeEach(() => {
    prisma.aIConfiguration = {
      findUnique: jest.fn().mockResolvedValue({
        humanHandoffPhone: "+12145550100",
        humanHandoffEmail: null,
      }),
    };
  });

  it("escalates successfully with valid reason", async () => {
    const result = await handoffToHumanTool.execute(
      { reason: "Customer requested human agent", urgency: "normal" },
      mockContext
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.escalated).toBe(true);
      expect(result.data.reason).toBe("Customer requested human agent");
    }
  });

  it("returns error when reason is missing", async () => {
    const result = await handoffToHumanTool.execute({}, mockContext);
    expect(result.success).toBe(false);
  });
});
