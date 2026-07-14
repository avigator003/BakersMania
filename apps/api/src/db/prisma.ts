import { PrismaClient } from "@prisma/client";
import { getCurrentTenantPrisma } from "./tenant-prisma-context.js";

export const platformPrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

export const prisma = new Proxy(platformPrisma, {
  get(_target, property) {
    const client = getCurrentTenantPrisma() || platformPrisma;
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  }
}) as PrismaClient;
