import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const prisma = new PrismaClient();
const tenantSlug = process.env.TENANT_SLUG || "star-bakery";
const confirmed = process.env.CLEAR_STAR_BAKERY_DATA === "YES";

const countedModels = {
  customers: "customer",
  products: "product",
  productCategories: "productCategory",
  customerProductPrices: "customerProductPrice",
  customerProductPreferences: "customerProductPreference",
  customerProductPriceHistory: "customerProductPriceHistory",
  routeProductPrices: "routeProductPrice",
  orders: "order",
  orderItems: "orderItem",
  orderStageHistory: "orderStageHistory",
  invoices: "invoice",
  payments: "payment",
  inventoryItems: "inventoryItem",
  inventoryLedgers: "inventoryLedger",
  suppliers: "supplier",
  purchases: "purchase",
  purchasePayments: "purchasePayment",
  expenses: "expense",
  vehicles: "vehicle",
  routes: "route",
  routeOrderLocks: "routeOrderLock",
  auditLogs: "auditLog",
  labours: "labour",
  attendance: "attendance",
  salaryPayments: "salaryPayment",
  memberships: "membership",
  subscriptions: "subscription"
};

async function getCounts(tenantId) {
  const counts = {};

  for (const [label, modelName] of Object.entries(countedModels)) {
    if (modelName === "orderItem") {
      counts[label] = await prisma.orderItem.count({ where: { order: { tenantId } } });
      continue;
    }

    counts[label] = await prisma[modelName].count({ where: { tenantId } });
  }

  return counts;
}

async function clearTenantData(tenantId) {
  const [memberships, customers, vehicles] = await Promise.all([
    prisma.membership.findMany({ where: { tenantId }, select: { userId: true } }),
    prisma.customer.findMany({ where: { tenantId }, select: { userId: true } }),
    prisma.vehicle.findMany({ where: { tenantId }, select: { userId: true } })
  ]);

  const memberUserIds = new Set(memberships.map((row) => row.userId).filter(Boolean));
  const removableUserIds = Array.from(
    new Set(
      [...customers, ...vehicles]
        .map((row) => row.userId)
        .filter((userId) => userId && !memberUserIds.has(userId))
    )
  );

  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { tenantId } });
    await tx.invoice.deleteMany({ where: { tenantId } });
    await tx.orderStageHistory.deleteMany({ where: { tenantId } });
    await tx.orderItem.deleteMany({ where: { order: { tenantId } } });
    await tx.order.deleteMany({ where: { tenantId } });

    await tx.purchasePayment.deleteMany({ where: { tenantId } });
    await tx.purchase.deleteMany({ where: { tenantId } });
    await tx.supplier.deleteMany({ where: { tenantId } });

    await tx.inventoryLedger.deleteMany({ where: { tenantId } });
    await tx.inventoryItem.deleteMany({ where: { tenantId } });

    await tx.expense.deleteMany({ where: { tenantId } });

    await tx.customerProductPriceHistory.deleteMany({ where: { tenantId } });
    await tx.customerProductPreference.deleteMany({ where: { tenantId } });
    await tx.customerProductPrice.deleteMany({ where: { tenantId } });
    await tx.routeProductPrice.deleteMany({ where: { tenantId } });
    await tx.routeOrderLock.deleteMany({ where: { tenantId } });

    await tx.customer.deleteMany({ where: { tenantId } });
    await tx.product.deleteMany({ where: { tenantId } });
    await tx.productCategory.deleteMany({ where: { tenantId } });
    await tx.route.deleteMany({ where: { tenantId } });
    await tx.vehicle.deleteMany({ where: { tenantId } });
    await tx.auditLog.deleteMany({ where: { tenantId } });

    if (removableUserIds.length) {
      await tx.user.deleteMany({ where: { id: { in: removableUserIds } } });
    }
  }, { timeout: 30000 });

  return { removedUsers: removableUserIds.length };
}

async function main() {
  if (tenantSlug !== "star-bakery" && process.env.ALLOW_NON_STAR_TENANT !== "YES") {
    throw new Error(`Refusing to clear unexpected tenant slug: ${tenantSlug}`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true, name: true }
  });

  if (!tenant) {
    console.log(JSON.stringify({ ok: false, tenantSlug, message: "Tenant not found" }, null, 2));
    return;
  }

  const before = await getCounts(tenant.id);

  if (!confirmed) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      tenant,
      before,
      message: "Set CLEAR_STAR_BAKERY_DATA=YES to delete all non-labour tenant data."
    }, null, 2));
    return;
  }

  const result = await clearTenantData(tenant.id);
  const after = await getCounts(tenant.id);

  console.log(JSON.stringify({
    ok: true,
    dryRun: false,
    tenant,
    before,
    after,
    preserved: ["labours", "attendance", "salaryPayments", "memberships", "subscriptions"],
    ...result
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
