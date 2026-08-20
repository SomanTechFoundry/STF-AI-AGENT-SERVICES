import { type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { businessHoursService } from "@/lib/services/business-hours.service";
import { parseBody, setBusinessHoursSchema } from "@/lib/validation";
import { successResponse, errorResponse } from "@/lib/utils/api-response";

type Params = { params: Promise<{ businessId: string }> };

// GET /api/businesses/:businessId/hours
export async function GET(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const hours = await businessHoursService.getHours(businessId);
    return successResponse(hours);
  } catch (err) {
    return errorResponse(err);
  }
}

// PUT /api/businesses/:businessId/hours — replace the full weekly schedule
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const body = await request.json();
    const input = parseBody(setBusinessHoursSchema, body);
    const hours = await businessHoursService.setHours(businessId, input);
    return successResponse(hours);
  } catch (err) {
    return errorResponse(err);
  }
}
