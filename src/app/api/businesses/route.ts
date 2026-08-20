import { type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { businessService } from "@/lib/services/business.service";
import { parseBody, createBusinessSchema } from "@/lib/validation";
import { successResponse, createdResponse, errorResponse } from "@/lib/utils/api-response";

// GET /api/businesses — list all businesses (super-admin only)
export async function GET(request: NextRequest) {
  try {
    requireApiKey(request);
    const businesses = await businessService.list();
    return successResponse(businesses);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/businesses — create a new business (onboard a client)
export async function POST(request: NextRequest) {
  try {
    requireApiKey(request);
    const body = await request.json();
    const input = parseBody(createBusinessSchema, body);
    const business = await businessService.create(input);
    return createdResponse(business);
  } catch (err) {
    return errorResponse(err);
  }
}
