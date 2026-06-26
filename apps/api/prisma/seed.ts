import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const envPaths = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")];
for (const path of envPaths) {
  if (existsSync(path)) {
    dotenv.config({ path });
    break;
  }
}

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || "admin@bakersmania.local";
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD || "Admin@123456";
  const ownerEmail = process.env.TEST_BAKERY_OWNER_EMAIL || "owner@sweetcrust.local";
  const ownerPassword = process.env.TEST_BAKERY_OWNER_PASSWORD || "Owner@123456";

  const [adminPasswordHash, ownerPasswordHash] = await Promise.all([
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash(ownerPassword, 12)
  ]);

  await prisma.platformAdmin.upsert({
    where: { email: adminEmail },
    update: { name: "Platform Admin", passwordHash: adminPasswordHash },
    create: {
      email: adminEmail,
      name: "Platform Admin",
      passwordHash: adminPasswordHash
    }
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "sweet-crust" },
    update: {
      name: "Sweet Crust Bakery",
      status: "TRIALING",
      ownerEmail,
      phone: "+91 98765 43210",
      address: "Local test bakery"
    },
    create: {
      name: "Sweet Crust Bakery",
      slug: "sweet-crust",
      status: "TRIALING",
      ownerEmail,
      phone: "+91 98765 43210",
      address: "Local test bakery"
    }
  });

  const lastPaymentDate = new Date();
  const lastPaymentPeriodFrom = new Date(lastPaymentDate.getFullYear(), lastPaymentDate.getMonth(), 1);
  const lastPaymentPeriodTo = new Date(lastPaymentDate.getFullYear(), lastPaymentDate.getMonth() + 1, 0);
  const nextDueDate = new Date(lastPaymentDate.getFullYear(), lastPaymentDate.getMonth() + 1, 1);

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { name: "Sweet Crust Owner", passwordHash: ownerPasswordHash, phone: "+91 98765 43210" },
    create: {
      email: ownerEmail,
      name: "Sweet Crust Owner",
      phone: "+91 98765 43210",
      passwordHash: ownerPasswordHash
    }
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: owner.id } },
    update: { role: "OWNER", active: true },
    create: { tenantId: tenant.id, userId: owner.id, role: "OWNER", active: true }
  });

  const subscription = await prisma.subscription.findFirst({ where: { tenantId: tenant.id } });
  if (subscription) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "TRIALING",
        planCode: "starter",
        billingStatus: "PENDING",
        recurrence: "MONTHLY",
        recurrenceMonths: 1,
        monthlyAmount: 1999,
        lastPaymentDate,
        lastPaymentPeriodFrom,
        lastPaymentPeriodTo,
        lastPaymentAmount: 1999,
        nextDueDate
      }
    });
  } else {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        status: "TRIALING",
        planCode: "starter",
        billingStatus: "PENDING",
        recurrence: "MONTHLY",
        recurrenceMonths: 1,
        monthlyAmount: 1999,
        lastPaymentDate,
        lastPaymentPeriodFrom,
        lastPaymentPeriodTo,
        lastPaymentAmount: 1999,
        nextDueDate
      }
    });
  }

  await prisma.product.createMany({
    data: [
      { tenantId: tenant.id, name: "Chocolate Truffle Cake", category: "Cakes", unitPrice: 850, taxRate: 5 },
      { tenantId: tenant.id, name: "Butter Croissant Box", category: "Pastries", unitPrice: 420, taxRate: 5 },
      { tenantId: tenant.id, name: "Custom Birthday Cake", category: "Custom", unitPrice: 1200, taxRate: 5 }
    ],
    skipDuplicates: true
  });

  const existingLabourCount = await prisma.labour.count({ where: { tenantId: tenant.id } });
  if (!existingLabourCount) {
    const [cakeChef, helper, packer] = await Promise.all([
      prisma.labour.create({
        data: {
          tenantId: tenant.id,
          name: "Ramesh Kumar",
          phone: "+91 90000 10001",
          skill: "Cake finishing",
          dailyWage: 850,
          monthlySalary: 22000,
          notes: "Senior labourer for custom cake finishing"
        }
      }),
      prisma.labour.create({
        data: {
          tenantId: tenant.id,
          name: "Sita Devi",
          phone: "+91 90000 10002",
          skill: "Packing and dispatch",
          dailyWage: 650,
          monthlySalary: 17000
        }
      }),
      prisma.labour.create({
        data: {
          tenantId: tenant.id,
          name: "Arjun Mehta",
          phone: "+91 90000 10003",
          skill: "Dough preparation",
          dailyWage: 700,
          monthlySalary: 18500
        }
      })
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.attendance.createMany({
      data: [
        { tenantId: tenant.id, userId: "", labourId: cakeChef.id, workDate: today, status: "PRESENT", notes: "Morning shift" },
        { tenantId: tenant.id, userId: "", labourId: helper.id, workDate: today, status: "PRESENT", notes: "Packing orders" },
        { tenantId: tenant.id, userId: "", labourId: packer.id, workDate: today, status: "HALF_DAY", notes: "Family work in afternoon" }
      ]
    });

    await prisma.salaryPayment.createMany({
      data: [
        {
          tenantId: tenant.id,
          userId: "",
          labourId: cakeChef.id,
          amount: 5000,
          period: "June 2026",
          paymentType: "ADVANCE",
          reason: "Festival expense advance",
          method: "Cash",
          paidAt: today
        },
        {
          tenantId: tenant.id,
          userId: "",
          labourId: helper.id,
          amount: 8500,
          period: "June 2026",
          paymentType: "PARTIAL",
          reason: "Partial salary before month end",
          method: "UPI",
          reference: "UPI-DEMO-001",
          paidAt: today
        },
        {
          tenantId: tenant.id,
          userId: "",
          labourId: packer.id,
          amount: 18500,
          period: "May 2026",
          paymentType: "FULL",
          reason: "Full monthly salary",
          method: "Bank",
          paidAt: new Date(today.getFullYear(), today.getMonth(), 2)
        }
      ]
    });
  }

  const customerPasswordHash = await bcrypt.hash("Customer@123456", 12);
  const customerUser = await prisma.user.upsert({
    where: { email: "customer@sweetcrust.local" },
    update: { name: "Sweet Crust Customer", passwordHash: customerPasswordHash, phone: "+91 98888 11111" },
    create: {
      email: "customer@sweetcrust.local",
      name: "Sweet Crust Customer",
      phone: "+91 98888 11111",
      passwordHash: customerPasswordHash
    }
  });

  const existingCustomer = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, userId: customerUser.id }
  });

  if (!existingCustomer) {
    await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        userId: customerUser.id,
        name: "Sweet Crust Customer",
        email: "customer@sweetcrust.local",
        phone: "+91 98888 11111",
        tags: ["portal"]
      }
    });
  }

  console.log("Seed complete");
  console.log(`Platform admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Bakery owner: ${ownerEmail} / ${ownerPassword}`);
  console.log("Customer: customer@sweetcrust.local / Customer@123456");
  console.log("Test bakery slug: sweet-crust");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
