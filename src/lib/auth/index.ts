/**
 * Authentication and authorization utilities.
 *
 * Phase 2: API key authentication for internal/admin routes.
 * Phase 6: Will add session-based auth for the dashboard.
 *
 * All protected API routes must call requireApiKey() at the top
 * before doing any work.
 */

import { type NextRequest } from "next/server";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

/**
 * Validate the API key from the request headers.
 * Throws UnauthorizedError if missing, ForbiddenError if invalid.
 *
 * Usage in a route handler:
 *   requireApiKey(request);  // throws if invalid
 */
export function requireApiKey(request: NextRequest): void {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    throw new UnauthorizedError("Missing x-api-key header");
  }

  const expectedKey = process.env.API_SECRET_KEY;
  if (!expectedKey) {
    // Server misconfiguration — don't reveal details to caller
    throw new ForbiddenError("Access denied");
  }

  if (!timingSafeEqual(apiKey, expectedKey)) {
    throw new ForbiddenError("Invalid API key");
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Regular === comparison leaks information about where strings differ.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Extract businessId from the URL path.
 * Routes follow the pattern: /api/businesses/:businessId/...
 *
 * Returns null if businessId is not present in the path.
 */
export function extractBusinessId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const bizIndex = segments.indexOf("businesses");
  if (bizIndex === -1 || bizIndex + 1 >= segments.length) return null;
  return segments[bizIndex + 1] || null;
}

/**
 * Extract and validate businessId from route params.
 * Throws ValidationError if the ID is missing or clearly invalid.
 */
export function requireBusinessId(params: { businessId?: string }): string {
  const id = params.businessId?.trim();
  if (!id) {
    const { ValidationError } = require("@/lib/errors");
    throw new ValidationError("businessId is required");
  }
  return id;
}
