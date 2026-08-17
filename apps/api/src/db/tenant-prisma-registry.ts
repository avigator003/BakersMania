import { PrismaClient } from "@prisma/client";
import { HttpError } from "../utils/http.js";

type TenantPrismaCacheEntry = {
  databaseUrl: string;
  client: PrismaClient;
};

const tenantClients = new Map<string, TenantPrismaCacheEntry>();

function createTenantClient(databaseUrl: string) {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}

export async function getTenantPrismaClient(input: {
  platformPrisma: PrismaClient;
  postgresConnectionId?: string | null;
}) {
  if (!input.postgresConnectionId) return input.platformPrisma;

  const cached = tenantClients.get(input.postgresConnectionId);
  if (cached) return cached.client;

  const connection = await input.platformPrisma.postgresConnection.findUnique({
    where: { id: input.postgresConnectionId },
    select: { id: true, databaseUrl: true }
  });

  if (!connection) {
    throw new HttpError(404, "Tenant database connection not found");
  }

  const client = createTenantClient(connection.databaseUrl);
  tenantClients.set(connection.id, { databaseUrl: connection.databaseUrl, client });
  return client;
}

export async function preloadTenantPrismaClients(platformPrisma: PrismaClient) {
  const tenants = await platformPrisma.tenant.findMany({
    where: {
      status: { not: "SUSPENDED" },
      postgresConnectionId: { not: null }
    },
    select: {
      slug: true,
      postgresConnectionId: true,
      postgresConnection: { select: { databaseUrl: true } }
    }
  });

  const preloadResults = await Promise.allSettled(
    tenants.map(async (tenant) => {
      if (!tenant.postgresConnectionId || !tenant.postgresConnection) return;
      if (tenantClients.has(tenant.postgresConnectionId)) return;
      const client = createTenantClient(tenant.postgresConnection.databaseUrl);
      await client.$connect();
      tenantClients.set(tenant.postgresConnectionId, {
        databaseUrl: tenant.postgresConnection.databaseUrl,
        client
      });
    })
  );

  const failed = preloadResults.filter((result) => result.status === "rejected");
  if (failed.length) {
    console.warn(`Skipped ${failed.length} tenant database client${failed.length === 1 ? "" : "s"} that could not connect`);
  }

  return { loaded: tenantClients.size, failed: failed.length };
}

export async function disconnectTenantPrismaClients() {
  await Promise.all(Array.from(tenantClients.values(), (entry) => entry.client.$disconnect()));
  tenantClients.clear();
}
