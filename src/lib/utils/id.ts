/**
 * ID and correlation utilities.
 *
 * We use CUID2 from Prisma for database IDs.
 * For request correlation IDs we use a lightweight crypto-based approach
 * that works in both Node.js and Edge runtime without external deps.
 */

export function generateRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Mask a value for safe logging (e.g. phone numbers, emails).
 * Shows first 3 and last 2 characters only.
 */
export function maskSensitive(value: string): string {
  if (value.length <= 5) return "***";
  return value.slice(0, 3) + "***" + value.slice(-2);
}

/**
 * Normalize a phone number to E.164 format for consistent storage.
 * Returns null if the number cannot be normalized.
 *
 * This is a basic normalizer — in production consider using
 * libphonenumber-js for proper international support.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 10 && raw.startsWith("+")) return `+${digits}`;
  return null;
}

/**
 * Normalize an email address to lowercase for consistent lookups.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
