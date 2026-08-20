import { type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { serviceService } from "@/lib/services/service.service";
import { parseBody, updateServiceSchema } from "@/lib/validation";
import { successResponse, errorResponse } from "@/lib/utils/api-response";

type Params = { params: Promise<{ businessId: string; serviceId: string }> };

// GET /api/businesses/:businessId/services/:serviceId
export async function GET(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId, serviceId } = await params;
    const service = await serviceService.getById(businessId, serviceId);
    return successResponse(service);
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/businesses/:businessId/services/:serviceId
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId, serviceId } = await params;
    const body = await request.json();
    const input = parseBody(updateServiceSchema, body);
    const service = await serviceService.update(businessId, serviceId, input);
    return successResponse(service);
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE /api/businesses/:businessId/services/:serviceId (soft deactivate)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId, serviceId } = await params;
    const service = await serviceService.deactivate(businessId, serviceId);
    return successResponse(service);
  } catch (err) {
    return errorResponse(err);
  }
}
