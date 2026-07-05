import { PrismaClient } from "@prisma/client";
import linuxQueryEnginePath from "../../../../node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node" with { type: "file" };
import { fileURLToPath } from "node:url";

if (!process.env.PRISMA_QUERY_ENGINE_LIBRARY && process.platform === "linux") {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = fileURLToPath(new URL(linuxQueryEnginePath, import.meta.url));
}

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});
