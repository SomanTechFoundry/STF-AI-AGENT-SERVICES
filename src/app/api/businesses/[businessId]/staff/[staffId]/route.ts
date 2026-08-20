import { type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { staffService } from "@/lib/services/staff.service";
import { parseBody, updateStaffSchema } from "@/lib/validation";
import { successResponse, errorResponse } from "@/lib/utils/api-response";

type Params = { params: Promise<{ businessId: string; staffId: string }> };

// GET /api/businesses/:businessId/staff/:staffId
export async function GET(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId, staffId } = await params;
    const staff = await staffService.getById(businessId, staffId);
    return successResponse(staff);
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/businesses/:businessId/staff/:staffId
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId, staffId } = await params;
    const body = await request.json();
    const input = parseBody(updateStaffSchema, body);
    const staff = await staffService.update(businessId, staffId, input);
    return successResponse(staff);
  } catch (err) {
    return errorResponse(err);
  }
}
