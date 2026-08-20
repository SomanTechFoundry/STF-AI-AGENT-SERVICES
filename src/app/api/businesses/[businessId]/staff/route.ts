import { type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { staffService } from "@/lib/services/staff.service";
import { parseBody, createStaffSchema } from "@/lib/validation";
import { successResponse, createdResponse, errorResponse } from "@/lib/utils/api-response";

type Params = { params: Promise<{ businessId: string }> };

// GET /api/businesses/:businessId/staff
export async function GET(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active") !== "false";
    const staff = await staffService.list(businessId, activeOnly);
    return successResponse(staff);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/businesses/:businessId/staff
export async function POST(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const body = await request.json();
    const input = parseBody(createStaffSchema, body);
    const staff = await staffService.create(businessId, input);
    return createdResponse(staff);
  } catch (err) {
    return errorResponse(err);
  }
}
