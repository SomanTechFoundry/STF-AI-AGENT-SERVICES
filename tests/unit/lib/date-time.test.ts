/**
 * Unit tests for date-time utilities.
 *
 * These tests use fixed, known UTC offsets for reliability.
 * America/Chicago is UTC-6 in winter (CST) and UTC-5 in summer (CDT).
 */

import {
  localToUtc,
  utcToLocal,
  getDayOfWeek,
  generateTimeSlots,
  intervalsOverlap,
  isDateInPast,
  isDateTooFarAhead,
  isSlotTooSoon,
  timeToMinutes,
  minutesToTime,
} from "@/lib/utils/date-time";

describe("timeToMinutes / minutesToTime", () => {
  it("converts time string to minutes", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("17:00")).toBe(1020);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("converts minutes back to time string", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(1020)).toBe("17:00");
    expect(minutesToTime(1439)).toBe("23:59");
  });

  it("round-trips correctly", () => {
    const times = ["09:00", "10:30", "14:45", "18:00"];
    for (const t of times) {
      expect(minutesToTime(timeToMinutes(t))).toBe(t);
    }
  });
});

describe("localToUtc + utcToLocal", () => {
  it("converts CST (UTC-6) winter time correctly", () => {
    // Jan 15 = winter, Chicago is CST = UTC-6
    // 09:00 Chicago CST = 15:00 UTC
    const utc = localToUtc("2025-01-15", "09:00", "America/Chicago");
    expect(utc.toISOString()).toBe("2025-01-15T15:00:00.000Z");
  });

  it("converts CDT (UTC-5) summer time correctly", () => {
    // Jun 15 = summer, Chicago is CDT = UTC-5
    // 09:00 Chicago CDT = 14:00 UTC
    const utc = localToUtc("2025-06-15", "09:00", "America/Chicago");
    expect(utc.toISOString()).toBe("2025-06-15T14:00:00.000Z");
  });

  it("round-trips local → UTC → local", () => {
    const dateStr = "2025-08-20";
    const timeStr = "14:30";
    const timezone = "America/Chicago";

    const utc = localToUtc(dateStr, timeStr, timezone);
    const local = utcToLocal(utc, timezone);

    expect(local.date).toBe(dateStr);
    expect(local.time).toBe(timeStr);
  });

  it("handles UTC timezone (no offset)", () => {
    const utc = localToUtc("2025-03-10", "12:00", "UTC");
    expect(utc.toISOString()).toBe("2025-03-10T12:00:00.000Z");
  });

  it("handles Eastern time (EST = UTC-5, EDT = UTC-4)", () => {
    // Feb = EST (UTC-5), so 10:00 EST = 15:00 UTC
    const utc = localToUtc("2025-02-05", "10:00", "America/New_York");
    expect(utc.toISOString()).toBe("2025-02-05T15:00:00.000Z");
  });
});

describe("getDayOfWeek", () => {
  it("returns correct day for known dates", () => {
    expect(getDayOfWeek("2025-01-06", "UTC")).toBe("MONDAY");    // Jan 6, 2025 is Monday
    expect(getDayOfWeek("2025-01-11", "UTC")).toBe("SATURDAY");
    expect(getDayOfWeek("2025-01-12", "UTC")).toBe("SUNDAY");
    expect(getDayOfWeek("2025-01-10", "UTC")).toBe("FRIDAY");
  });

  it("respects timezone for day boundary", () => {
    // 2025-01-06T01:00:00Z is Monday 01:00 UTC
    // but in UTC-6 (Chicago) it's Sunday 19:00 the previous day
    // getDayOfWeek uses noon to avoid boundary issues
    expect(getDayOfWeek("2025-01-06", "America/Chicago")).toBe("MONDAY");
  });
});

describe("generateTimeSlots", () => {
  it("generates slots from 09:00 to 17:00 with 60-min service, 30-min interval", () => {
    const slots = generateTimeSlots("09:00", "17:00", 30, 60, 0);
    // Last slot must start at or before 16:00 (16:00 + 60 = 17:00)
    expect(slots[0]).toBe("09:00");
    expect(slots[slots.length - 1]).toBe("16:00");
    expect(slots).toContain("09:30");
    expect(slots).toContain("10:00");
    expect(slots).not.toContain("16:30"); // 16:30 + 60 = 17:30, over close
  });

  it("respects service buffer time", () => {
    // 60-min service + 15-min buffer = 75-min slot width
    const slots = generateTimeSlots("09:00", "17:00", 30, 60, 15);
    // Last slot: 09:00 + n*30 such that slot + 75 <= 17:00 → slot <= 15:45
    const last = slots[slots.length - 1];
    const lastMins = last.split(":").reduce((h, m, i) => i === 0 ? parseInt(h.toString())*60 : parseInt(h.toString()) + parseInt(m), 0 as unknown as number);
    // 15:45 + 75 = 17:00 ✓
    expect(timeToMinutes(last) + 60 + 15).toBeLessThanOrEqual(timeToMinutes("17:00"));
  });

  it("returns empty array when open + service > close", () => {
    // 1 hour service, 09:00–09:30 window
    const slots = generateTimeSlots("09:00", "09:30", 30, 60, 0);
    expect(slots).toHaveLength(0);
  });

  it("generates exactly one slot when window equals service duration", () => {
    const slots = generateTimeSlots("09:00", "10:00", 30, 60, 0);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toBe("09:00");
  });
});

describe("intervalsOverlap", () => {
  const d = (h: number, m = 0) => new Date(2025, 0, 1, h, m); // local dates for comparison

  it("returns true for exact overlap", () => {
    expect(intervalsOverlap(d(9), d(10), d(9), d(10))).toBe(true);
  });

  it("returns true when B starts inside A", () => {
    expect(intervalsOverlap(d(9), d(11), d(10), d(12))).toBe(true);
  });

  it("returns true when A starts inside B", () => {
    expect(intervalsOverlap(d(10), d(12), d(9), d(11))).toBe(true);
  });

  it("returns true when A is entirely inside B", () => {
    expect(intervalsOverlap(d(10), d(11), d(9), d(12))).toBe(true);
  });

  it("returns false when A ends exactly when B starts (touching, not overlapping)", () => {
    expect(intervalsOverlap(d(9), d(10), d(10), d(11))).toBe(false);
  });

  it("returns false when B ends exactly when A starts", () => {
    expect(intervalsOverlap(d(10), d(11), d(9), d(10))).toBe(false);
  });

  it("returns false when A is entirely before B", () => {
    expect(intervalsOverlap(d(9), d(10), d(11), d(12))).toBe(false);
  });

  it("returns false when A is entirely after B", () => {
    expect(intervalsOverlap(d(11), d(12), d(9), d(10))).toBe(false);
  });
});

describe("isDateInPast", () => {
  it("returns false for today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isDateInPast(today, "UTC")).toBe(false);
  });

  it("returns true for yesterday", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    expect(isDateInPast(yesterday, "UTC")).toBe(true);
  });

  it("returns false for tomorrow", () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(isDateInPast(tomorrow, "UTC")).toBe(false);
  });
});

describe("isDateTooFarAhead", () => {
  const futureDate = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  it("returns false when within limit", () => {
    expect(isDateTooFarAhead(futureDate(30), "UTC", 60)).toBe(false);
  });

  it("returns true when beyond limit", () => {
    expect(isDateTooFarAhead(futureDate(61), "UTC", 60)).toBe(true);
  });

  it("returns false for exactly the limit day", () => {
    expect(isDateTooFarAhead(futureDate(60), "UTC", 60)).toBe(false);
  });
});

describe("isSlotTooSoon", () => {
  it("returns true for a slot 30 minutes from now when lead time is 60 minutes", () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000);
    const dateStr = soon.toISOString().slice(0, 10);
    const timeStr = soon.toISOString().slice(11, 16);
    expect(isSlotTooSoon(dateStr, timeStr, "UTC", 60)).toBe(true);
  });

  it("returns false for a slot 2 hours from now when lead time is 60 minutes", () => {
    const future = new Date(Date.now() + 120 * 60 * 1000);
    const dateStr = future.toISOString().slice(0, 10);
    const timeStr = future.toISOString().slice(11, 16);
    expect(isSlotTooSoon(dateStr, timeStr, "UTC", 60)).toBe(false);
  });
});
