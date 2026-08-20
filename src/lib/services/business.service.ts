/**
 * BusinessService — tenant management.
 *
 * This is the only place in the codebase allowed to create or query
 * businesses without a pre-existing businessId context.
 * All other services receive businessId as a parameter.
 */

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { NotFoundError, AppError, ErrorCode } from "@/lib/errors";
import type { CreateBusinessInput, UpdateBusinessInput } from "@/lib/validation";
import type { Business } from "@prisma/client";

export class BusinessService {
  async create(input: CreateBusinessInput): Promise<Business> {
    logger.info("Creating business", { service: "BusinessService" });

    try {
      const business = await prisma.business.create({
        data: {
          name: input.name,
          slug: input.slug,
          industry: input.industry,
          email: input.email ?? null,
          phone: input.phone ?? null,
          website: input.website ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          postalCode: input.postalCode ?? null,
          country: input.country,
          timezone: input.timezone,
          bookingLeadTimeMinutes: input.bookingLeadTimeMinutes,
          bookingMaxDaysAhead: input.bookingMaxDaysAhead,
          cancellationPolicyHours: input.cancellationPolicyHours,
        },
      });

      logger.info("Business created", {
        service: "BusinessService",
        businessId: business.id,
      });

      return business;
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `A business with slug "${input.slug}" already exists`,
          409
        );
      }
      throw err;
    }
  }

  async getById(businessId: string): Promise<Business> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundError("Business", businessId);
    }

    return business;
  }

  async getBySlug(slug: string): Promise<Business> {
    const business = await prisma.business.findUnique({
      where: { slug },
    });

    if (!business) {
      throw new NotFoundError("Business");
    }

    return business;
  }

  async list(): Promise<Business[]> {
    return prisma.business.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async update(businessId: string, input: UpdateBusinessInput): Promise<Business> {
    await this.getById(businessId);

    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.industry !== undefined && { industry: input.industry }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.website !== undefined && { website: input.website }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
        ...(input.country !== undefined && { country: input.country }),
        ...(input.timezone !== undefined && { timezone: input.timezone }),
        ...(input.bookingLeadTimeMinutes !== undefined && {
          bookingLeadTimeMinutes: input.bookingLeadTimeMinutes,
        }),
        ...(input.bookingMaxDaysAhead !== undefined && {
          bookingMaxDaysAhead: input.bookingMaxDaysAhead,
        }),
        ...(input.cancellationPolicyHours !== undefined && {
          cancellationPolicyHours: input.cancellationPolicyHours,
        }),
      },
    });

    logger.info("Business updated", { businessId });
    return business;
  }

  async suspend(businessId: string): Promise<Business> {
    await this.getById(businessId);
    return prisma.business.update({
      where: { id: businessId },
      data: { status: "SUSPENDED" },
    });
  }

  async activate(businessId: string): Promise<Business> {
    await this.getById(businessId);
    return prisma.business.update({
      where: { id: businessId },
      data: { status: "ACTIVE" },
    });
  }
}

export const businessService = new BusinessService();
