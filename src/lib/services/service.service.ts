/**
 * ServiceService — manage bookable services per business.
 * All queries are scoped to businessId.
 */

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { NotFoundError } from "@/lib/errors";
import type { CreateServiceInput, UpdateServiceInput } from "@/lib/validation";
import type { Service } from "@prisma/client";

export class ServiceService {
  async create(businessId: string, input: CreateServiceInput): Promise<Service> {
    const service = await prisma.service.create({
      data: {
        businessId,
        name: input.name,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes,
        price: input.price,
        currency: input.currency,
        category: input.category ?? null,
        bufferMinutes: input.bufferMinutes,
        isActive: input.isActive,
      },
    });

    logger.info("Service created", { businessId, serviceId: service.id });
    return service;
  }

  async getById(businessId: string, serviceId: string): Promise<Service> {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service || service.businessId !== businessId) {
      throw new NotFoundError("Service", serviceId);
    }

    return service;
  }

  async list(businessId: string, activeOnly = true): Promise<Service[]> {
    return prisma.service.findMany({
      where: {
        businessId,
        ...(activeOnly && { isActive: true }),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async update(
    businessId: string,
    serviceId: string,
    input: UpdateServiceInput
  ): Promise<Service> {
    await this.getById(businessId, serviceId);

    return prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.durationMinutes !== undefined && {
          durationMinutes: input.durationMinutes,
        }),
        ...(input.price !== undefined && { price: input.price }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.bufferMinutes !== undefined && {
          bufferMinutes: input.bufferMinutes,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  async deactivate(businessId: string, serviceId: string): Promise<Service> {
    await this.getById(businessId, serviceId);
    return prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });
  }

  /**
   * Find a service by name (case-insensitive) within a business.
   * Used by the AI agent to resolve service names from customer messages.
   */
  async findByName(businessId: string, name: string): Promise<Service | null> {
    return prisma.service.findFirst({
      where: {
        businessId,
        isActive: true,
        name: { equals: name, mode: "insensitive" },
      },
    });
  }
}

export const serviceService = new ServiceService();
