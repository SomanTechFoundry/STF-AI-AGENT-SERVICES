/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reload creates new module instances on every
 * file change. Without this singleton pattern, we would exhaust the Postgres
 * connection pool quickly. The global variable persists across hot reloads.
 *
 * In production, the module is loaded once and the client is reused normally.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
