import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || "";
const url = new URL(databaseUrl);

if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
  throw new Error(`Refusing to reset non-local database host: ${url.hostname}`);
}

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.PLATFORM_ADMIN_EMAIL || "admin@bakersmania.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.PLATFORM_ADMIN_PASSWORD || "Admin@123456";

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.orderItem.deleteMany({});
    await tx.order.deleteMany({});
    await tx.purchasePayment.deleteMany({});
    await tx.purchase.deleteMany({});
    await tx.supplier.deleteMany({});
    await tx.inventoryLedger.deleteMany({});
    await tx.inventoryItem.deleteMany({});
    await tx.expense.deleteMany({});
    await tx.attendance.deleteMany({});
    await tx.salaryPayment.deleteMany({});
    await tx.labour.deleteMany({});
    await tx.customerProductPriceHistory.deleteMany({});
    await tx.customerProductPrice.deleteMany({});
    await tx.customer.deleteMany({});
    await tx.product.deleteMany({});
    await tx.productCategory.deleteMany({});
    await tx.route.deleteMany({});
    await tx.vehicle.deleteMany({});
    await tx.subscription.deleteMany({});
    await tx.auditLog.deleteMany({});
    await tx.membership.deleteMany({});
    await tx.tenant.deleteMany({});
    await tx.user.deleteMany({});
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.platformAdmin.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: "Platform Admin", passwordHash },
    create: { email: ADMIN_EMAIL, name: "Platform Admin", passwordHash }
  });

  const counts = {
    platformAdmins: await prisma.platformAdmin.count(),
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    products: await prisma.product.count(),
    orders: await prisma.order.count()
  };

  console.log(JSON.stringify({ databaseHost: url.hostname, adminEmail: ADMIN_EMAIL, counts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
