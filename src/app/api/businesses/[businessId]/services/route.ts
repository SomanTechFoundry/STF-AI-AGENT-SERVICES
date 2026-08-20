import { type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { serviceService } from "@/lib/services/service.service";
import { parseBody, createServiceSchema } from "@/lib/validation";
import { successResponse, createdResponse, errorResponse } from "@/lib/utils/api-response";

type Params = { params: Promise<{ businessId: string }> };

// GET /api/businesses/:businessId/services
export async function GET(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active") !== "false";
    const services = await serviceService.list(businessId, activeOnly);
    return successResponse(services);
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/businesses/:businessId/services
export async function POST(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const body = await request.json();
    const input = parseBody(createServiceSchema, body);
    const service = await serviceService.create(businessId, input);
    return createdResponse(service);
  } catch (err) {
    return errorResponse(err);
  }
}
