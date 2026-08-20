import { type NextRequest } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { customerService } from "@/lib/services/customer.service";
import { parseBody, updateCustomerSchema } from "@/lib/validation";
import { successResponse, errorResponse } from "@/lib/utils/api-response";

type Params = { params: Promise<{ businessId: string; customerId: string }> };

// GET /api/businesses/:businessId/customers/:customerId
export async function GET(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId, customerId } = await params;
    const customer = await customerService.getById(businessId, customerId);
    return successResponse(customer);
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/businesses/:businessId/customers/:customerId
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    requireApiKey(request);
    const { businessId, customerId } = await params;
    const body = await request.json();
    const input = parseBody(updateCustomerSchema, body);
    const customer = await customerService.update(businessId, customerId, input);
    return successResponse(customer);
  } catch (err) {
    return errorResponse(err);
  }
}
