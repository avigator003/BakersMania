import type { PrismaClient, Tenant } from "@prisma/client";
import type { AccessTokenPayload } from "../utils/tokens.js";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: AccessTokenPayload;
      tenant?: Tenant;
      tenantDb?: PrismaClient;
    }
  }
}

export {};
