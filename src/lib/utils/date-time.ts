/**
 * Timezone-aware date/time utilities.
 *
 * Uses the native Intl API — no external libraries required.
 * All appointments are stored as UTC; display is in the business timezone.
 *
 * Key design rules:
 * - "dateStr"  is always "YYYY-MM-DD"
 * - "timeStr"  is always "HH:MM" (24-hour)
 * - "timezone" is always an IANA timezone string (e.g. "America/Chicago")
 */

import type { DayOfWeek } from "@prisma/client";

// ============================================================
// Conversion helpers
// ============================================================

/**
 * Convert a local date + time in a given timezone to a UTC Date.
 *
 * Algorithm (no library needed):
 * 1. Treat the local time as if it were UTC (naïve UTC)
 * 2. Format that naïve UTC Date in the target timezone → get what local time it *actually* shows
 * 3. Compute the drift between the naïve local string and the actual local string
 * 4. Apply the drift correction to get the true UTC instant
 */
export function localToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const naive = new Date(`${dateStr}T${timeStr}:00.000Z`);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(naive);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  const localAsUtcStr = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}.000Z`;
  const localAsUtc = new Date(localAsUtcStr);

  // drift: how far off the naive UTC was from the true local time
  const offsetMs = naive.getTime() - localAsUtc.getTime();
  return new Date(naive.getTime() + offsetMs);
}

/**
 * Convert a UTC Date to a local date + time string in a given timezone.
 * Returns { date: "YYYY-MM-DD", time: "HH:MM" }
 */
export function utcToLocal(utcDate: Date, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(utcDate);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * Return the day-of-week for a date string in a given timezone.
 * Maps to Prisma's DayOfWeek enum.
 */
export function getDayOfWeek(dateStr: string, timezone: string): DayOfWeek {
  // Use noon UTC to avoid any midnight boundary issues
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(date);

  const map: Record<string, DayOfWeek> = {
    Monday: "MONDAY",
    Tuesday: "TUESDAY",
    Wednesday: "WEDNESDAY",
    Thursday: "THURSDAY",
    Friday: "FRIDAY",
    Saturday: "SATURDAY",
    Sunday: "SUNDAY",
  };

  return map[dayName] ?? "MONDAY";
}

// ============================================================
// Slot generation
// ============================================================

/**
 * Generate candidate time slots between openTime and closeTime.
 *
 * @param openTime       "09:00"
 * @param closeTime      "18:00"
 * @param slotIntervalMin  Granularity (e.g. 30 = every 30 min)
 * @param durationMin    Service duration — last slot must start early enough
 *                       that the appointment finishes before closeTime
 * @param bufferMin      Post-appointment buffer included in slot width
 */
export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  slotIntervalMin: number,
  durationMin: number,
  bufferMin: number
): string[] {
  const openMins = timeToMinutes(openTime);
  const closeMins = timeToMinutes(closeTime);
  const slotWidthMins = durationMin + bufferMin;

  const slots: string[] = [];
  let cursor = openMins;

  while (cursor + slotWidthMins <= closeMins) {
    slots.push(minutesToTime(cursor));
    cursor += slotIntervalMin;
  }

  return slots;
}

// ============================================================
// Booking constraint checks
// ============================================================

/**
 * Returns true if the requested date is within the booking lead-time window
 * (i.e. too soon to book).
 *
 * @param dateStr         "YYYY-MM-DD"
 * @param timeStr         "HH:MM" of the requested slot
 * @param timezone        Business timezone
 * @param leadTimeMinutes Minimum notice required
 */
export function isSlotTooSoon(
  dateStr: string,
  timeStr: string,
  timezone: string,
  leadTimeMinutes: number
): boolean {
  const slotUtc = localToUtc(dateStr, timeStr, timezone);
  const nowUtc = new Date();
  const diffMs = slotUtc.getTime() - nowUtc.getTime();
  return diffMs < leadTimeMinutes * 60 * 1000;
}

/**
 * Returns true if the requested date is beyond the allowed booking window.
 *
 * @param dateStr       "YYYY-MM-DD"
 * @param timezone      Business timezone
 * @param maxDaysAhead  Maximum days in advance
 */
export function isDateTooFarAhead(
  dateStr: string,
  timezone: string,
  maxDaysAhead: number
): boolean {
  const { date: todayStr } = utcToLocal(new Date(), timezone);
  const todayMidnightUtc = new Date(`${todayStr}T00:00:00.000Z`);
  const requestedMidnightUtc = new Date(`${dateStr}T00:00:00.000Z`);
  const diffDays =
    (requestedMidnightUtc.getTime() - todayMidnightUtc.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > maxDaysAhead;
}

/**
 * Returns true if the date is in the past (in the business timezone).
 */
export function isDateInPast(dateStr: string, timezone: string): boolean {
  const { date: todayStr } = utcToLocal(new Date(), timezone);
  return dateStr < todayStr;
}

// ============================================================
// Conflict detection
// ============================================================

/**
 * Returns true if [startA, endA) and [startB, endB) overlap.
 * Standard interval overlap: startA < endB && endA > startB
 */
export function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA < endB && endA > startB;
}

// ============================================================
// Low-level helpers
// ============================================================

/** "09:30" → 570 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 570 → "09:30" */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** Format UTC Date as "YYYY-MM-DD HH:MM" in a given timezone (for logging). */
export function formatForDisplay(utcDate: Date, timezone: string): string {
  const { date, time } = utcToLocal(utcDate, timezone);
  return `${date} ${time}`;
}

// ============================================================
// Relative date resolution — grounds the AI in "now" and lets it
// (or a defensive fallback) convert "today"/"tomorrow"/"next friday"
// into a real YYYY-MM-DD date in the business's timezone.
// ============================================================

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/**
 * Build a grounding block for the system prompt: today's date, day name,
 * current time, and a lookup table of the next N calendar days mapped to
 * their date + weekday label. Giving the model a lookup table (rather than
 * asking it to do date arithmetic from a single anchor) dramatically
 * improves accuracy for relative date expressions like "next Friday".
 */
export function getRelativeDateReference(
  timezone: string,
  daysAhead = 14
): { todayStr: string; todayLabel: string; currentTime: string; table: string } {
  const now = new Date();
  const { date: todayStr, time: currentTime } = utcToLocal(now, timezone);
  const todayAnchor = new Date(`${todayStr}T00:00:00.000Z`);

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(todayAnchor);

  const lines: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(todayAnchor.getTime() + i * 86_400_000);
    const dateStr = d.toISOString().slice(0, 10);
    const dayName = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(d);
    const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(d);
    const label = i === 0 ? "TODAY" : i === 1 ? "TOMORROW" : dayName.toUpperCase();
    lines.push(`${dateStr} = ${label} (${dayName}, ${monthDay})`);
  }

  return { todayStr, todayLabel, currentTime, table: lines.join("\n") };
}

/**
 * Defensive fallback: resolves common relative date phrases into a
 * YYYY-MM-DD string, anchored to "now" in the given timezone. Used inside
 * tool executors in case the AI passes a relative phrase instead of an
 * ISO date despite prompt instructions.
 *
 * Returns null if the input can't be confidently resolved.
 */
export function resolveRelativeDate(input: string, timezone: string): string | null {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  const { date: todayStr } = utcToLocal(new Date(), timezone);
  const todayAnchor = new Date(`${todayStr}T00:00:00.000Z`);
  const addDays = (days: number) => new Date(todayAnchor.getTime() + days * 86_400_000).toISOString().slice(0, 10);

  if (lower === "today" || lower === "now") return addDays(0);
  if (lower === "tomorrow") return addDays(1);
  if (lower === "day after tomorrow") return addDays(2);
  if (lower === "next week") return addDays(7);
  if (lower === "this weekend") return addDays((6 - todayAnchor.getUTCDay() + 7) % 7 || 6); // upcoming Saturday

  const weekdayMatch = lower.match(
    /^(this\s+|next\s+|on\s+|the\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/
  );
  if (weekdayMatch) {
    const qualifier = (weekdayMatch[1] ?? "").trim();
    const targetDow = WEEKDAY_INDEX[weekdayMatch[2] as string];
    const todayDow = todayAnchor.getUTCDay();
    let diff = (targetDow - todayDow + 7) % 7;
    if (diff === 0 && qualifier === "next") diff = 7;
    return addDays(diff);
  }

  return null;
}
