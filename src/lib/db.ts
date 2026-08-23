import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * Single Prisma Client instance per process (Next.js dev-mode hot reload would
 * otherwise create a new one — and a new connection pool — on every edit).
 *
 * Swapping to Postgres in production: change DATABASE_URL, replace this
 * adapter with `@prisma/adapter-pg` (see .agents/skills/prisma-database-setup),
 * and re-run `prisma migrate deploy`. No model or query code changes.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
