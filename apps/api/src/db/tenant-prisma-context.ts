import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";

const tenantPrismaContext = new AsyncLocalStorage<PrismaClient>();

export function runWithTenantPrisma<T>(client: PrismaClient, callback: () => T) {
  return tenantPrismaContext.run(client, callback);
}

export function getCurrentTenantPrisma() {
  return tenantPrismaContext.getStore();
}
