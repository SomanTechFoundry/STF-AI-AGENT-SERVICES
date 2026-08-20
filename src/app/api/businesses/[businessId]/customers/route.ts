import { type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { customerService } from "@/lib/services/customer.service";
import { parseBody, createCustomerSchema } from "@/lib/validation";
import { successResponse, createdResponse, errorResponse } from "@/lib/utils/api-response";

type Params = { params: Promise<{ businessId: string }> };

// GET /api/businesses/:businessId/customers?search=&limit=&offset=
export async function GET(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const limit = url.searchParams.get("limit")
      ? parseInt(url.searchParams.get("limit")!, 10)
      : 50;
    const offset = url.searchParams.get("offset")
      ? parseInt(url.searchParams.get("offset")!, 10)
      : 0;

    const result = await customerService.list(businessId, { limit, offset, search });
    return successResponse(result.customers, 200, {
      total: result.total,
      limit,
      offset,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/businesses/:businessId/customers
export async function POST(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId } = await params;
    const body = await request.json();
    const input = parseBody(createCustomerSchema, body);
    const { customer, created } = await customerService.findOrCreate(businessId, input);
    return created ? createdResponse(customer) : successResponse(customer);
  } catch (err) {
    return errorResponse(err);
  }
}
