import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const prisma = new PrismaClient();

const main = async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: process.env.TENANT_SLUG || "star-bakery" },
    select: { id: true, slug: true }
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  const legacyCustomers = await prisma.customer.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { tags: { has: "Driver (Sales Man)" } },
        { notes: { contains: "Legacy vehicle number:" } }
      ]
    },
    select: {
      id: true,
      userId: true,
      name: true,
      phone: true,
      _count: { select: { orders: true } }
    }
  });

  const blocked = legacyCustomers.filter((customer) => customer._count.orders > 0);
  if (blocked.length) {
    throw new Error(`Refusing to delete ${blocked.length} legacy route account(s) that still have orders.`);
  }

  const customerIds = legacyCustomers.map((customer) => customer.id);
  const userIds = legacyCustomers.map((customer) => customer.userId).filter(Boolean);

  await prisma.$transaction(async (tx) => {
    await tx.customerProductPriceHistory.deleteMany({ where: { tenantId: tenant.id, customerId: { in: customerIds } } });
    await tx.customerProductPreference.deleteMany({ where: { tenantId: tenant.id, customerId: { in: customerIds } } });
    await tx.customerProductPrice.deleteMany({ where: { tenantId: tenant.id, customerId: { in: customerIds } } });
    await tx.customer.deleteMany({ where: { tenantId: tenant.id, id: { in: customerIds } } });
    if (userIds.length) {
      await tx.user.deleteMany({
        where: {
          id: { in: userIds },
          memberships: { none: {} },
          customers: { none: {} },
          vehicles: { none: {} }
        }
      });
    }
  }, { timeout: 30000 });

  console.log(JSON.stringify({
    tenant: tenant.slug,
    deletedLegacyRouteAccounts: legacyCustomers.length,
    names: legacyCustomers.map((customer) => customer.name).sort()
  }, null, 2));
};

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
