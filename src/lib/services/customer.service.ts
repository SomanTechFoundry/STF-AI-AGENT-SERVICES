/**
 * CustomerService — all operations are scoped to a businessId.
 * This enforces tenant isolation at the service layer.
 */

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { NotFoundError, AppError, ErrorCode } from "@/lib/errors";
import { normalizePhone, normalizeEmail } from "@/lib/utils/id";
import type { CreateCustomerInput, UpdateCustomerInput } from "@/lib/validation";
import type { Customer } from "@prisma/client";

export class CustomerService {
  /**
   * Find a customer by phone or email within a business.
   * Returns null if not found (does not throw).
   */
  async findByContact(
    businessId: string,
    contact: { phone?: string | null; email?: string | null }
  ): Promise<Customer | null> {
    const phone = contact.phone ? normalizePhone(contact.phone) : null;
    const email = contact.email ? normalizeEmail(contact.email) : null;

    if (!phone && !email) return null;

    return prisma.customer.findFirst({
      where: {
        businessId,
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });
  }

  /**
   * Create a new customer scoped to the business.
   * Phone is normalized to E.164 format before storage.
   */
  async create(businessId: string, input: CreateCustomerInput): Promise<Customer> {
    const phone = input.phone ? normalizePhone(input.phone) : null;
    const email = input.email ? normalizeEmail(input.email) : null;

    if (input.phone && !phone) {
      const { ValidationError } = await import("@/lib/errors");
      throw new ValidationError("Invalid phone number format", {
        phone: "Could not parse phone number — use format: (214) 555-1234 or +12145551234",
      });
    }

    try {
      const customer = await prisma.customer.create({
        data: {
          businessId,
          name: input.name ?? null,
          phone,
          email,
          notes: input.notes ?? null,
          preferredChannel: input.preferredChannel,
          smsOptIn: input.smsOptIn,
          emailOptIn: input.emailOptIn,
          smsOptInAt: input.smsOptIn ? new Date() : null,
        },
      });

      logger.info("Customer created", { businessId, customerId: customer.id });
      return customer;
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new AppError(
          ErrorCode.CUSTOMER_ALREADY_EXISTS,
          "A customer with this phone or email already exists for this business",
          409
        );
      }
      throw err;
    }
  }

  /**
   * Find or create a customer — used by the agent to identify callers.
   * If an existing customer is found and the new input grants SMS opt-in
   * (or updates email opt-in / missing contact fields), those fields are
   * refreshed so a returning customer who provides a phone mid-chat still
   * receives SMS confirmations.
   */
  async findOrCreate(
    businessId: string,
    input: CreateCustomerInput
  ): Promise<{ customer: Customer; created: boolean }> {
    const existing = await this.findByContact(businessId, {
      phone: input.phone,
      email: input.email,
    });

    if (existing) {
      const needsUpdate =
        (input.smsOptIn === true && !existing.smsOptIn) ||
        (input.emailOptIn === true && !existing.emailOptIn) ||
        (input.name && !existing.name) ||
        (input.phone && !existing.phone) ||
        (input.email && !existing.email);

      if (needsUpdate) {
        const updated = await this.update(businessId, existing.id, {
          ...(input.smsOptIn === true && { smsOptIn: true }),
          ...(input.emailOptIn === true && { emailOptIn: true }),
          ...(input.name && !existing.name && { name: input.name }),
          ...(input.phone && !existing.phone && { phone: input.phone }),
          ...(input.email && !existing.email && { email: input.email }),
        });
        return { customer: updated, created: false };
      }

      return { customer: existing, created: false };
    }

    const customer = await this.create(businessId, input);
    return { customer, created: true };
  }

  async getById(businessId: string, customerId: string): Promise<Customer> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    // Enforce tenant isolation — throw 404 rather than 403 to not reveal existence
    if (!customer || customer.businessId !== businessId) {
      throw new NotFoundError("Customer", customerId);
    }

    return customer;
  }

  async list(
    businessId: string,
    options?: { limit?: number; offset?: number; search?: string }
  ): Promise<{ customers: Customer[]; total: number }> {
    const limit = Math.min(options?.limit ?? 50, 100);
    const offset = options?.offset ?? 0;
    const search = options?.search?.trim();

    const where = {
      businessId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total };
  }

  async update(
    businessId: string,
    customerId: string,
    input: UpdateCustomerInput
  ): Promise<Customer> {
    await this.getById(businessId, customerId);

    const phone =
      input.phone !== undefined
        ? input.phone
          ? normalizePhone(input.phone)
          : null
        : undefined;

    const email =
      input.email !== undefined
        ? input.email
          ? normalizeEmail(input.email)
          : null
        : undefined;

    return prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.preferredChannel !== undefined && {
          preferredChannel: input.preferredChannel,
        }),
        ...(input.smsOptIn !== undefined && {
          smsOptIn: input.smsOptIn,
          smsOptInAt: input.smsOptIn ? new Date() : null,
        }),
        ...(input.emailOptIn !== undefined && { emailOptIn: input.emailOptIn }),
      },
    });
  }
}

export const customerService = new CustomerService();
