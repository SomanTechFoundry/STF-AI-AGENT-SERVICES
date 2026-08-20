import { type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { businessService } from "@/lib/services/business.service";
import { parseBody, updateBusinessSchema } from "@/lib/validation";
import { successResponse, errorResponse } from "@/lib/utils/api-response";

type Params = { params: Promise<{ businessId: string }> };

// GET /api/businesses/:businessId
export async function GET(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const business = await businessService.getById(businessId);
    return successResponse(business);
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/businesses/:businessId
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const body = await request.json();
    const input = parseBody(updateBusinessSchema, body);
    const business = await businessService.update(businessId, input);
    return successResponse(business);
  } catch (err) {
    return errorResponse(err);
  }
}
