import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || "";
const url = new URL(databaseUrl);

if (process.env.RESET_CLOUD_DB !== "YES") {
  throw new Error("Refusing to reset database without RESET_CLOUD_DB=YES");
}

if (url.pathname.replace("/", "") !== "neondb") {
  throw new Error(`Refusing to reset unexpected database: ${url.pathname}`);
}

const prisma = new PrismaClient();

const credentials = {
  platformAdmin: {
    email: "admin@bakersmania.local",
    password: "Admin@123456"
  },
  bakeryOwner: {
    email: "owner@sweetcrust.local",
    password: "Owner@123456"
  },
  customer: {
    email: "customer@sweetcrust.local",
    phone: "+919800000101",
    password: "Customer@123456"
  },
  vehicle: {
    email: "vehicle@sweetcrust.local",
    phone: "+919800000201",
    password: "Vehicle@123456"
  }
};

async function hash(password) {
  return bcrypt.hash(password, 12);
}

async function clearDatabase() {
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
    await tx.platformAdmin.deleteMany({});
  }, { timeout: 30000 });
}

async function seedDemo() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const [platformHash, ownerHash, customerHash, vehicleHash] = await Promise.all([
    hash(credentials.platformAdmin.password),
    hash(credentials.bakeryOwner.password),
    hash(credentials.customer.password),
    hash(credentials.vehicle.password)
  ]);

  await prisma.platformAdmin.create({
    data: {
      email: credentials.platformAdmin.email,
      name: "Platform Admin",
      passwordHash: platformHash
    }
  });

  const tenant = await prisma.tenant.create({
    data: {
      name: "Sweet Crust Bakery",
      slug: "sweet-crust",
      status: "TRIALING",
      ownerEmail: credentials.bakeryOwner.email,
      phone: "+91 98765 43210",
      address: "Demo bakery, Jaipur"
    }
  });

  const owner = await prisma.user.create({
    data: {
      email: credentials.bakeryOwner.email,
      name: "Sweet Crust Owner",
      phone: "+919876543210",
      passwordHash: ownerHash
    }
  });

  await prisma.membership.create({
    data: {
      tenantId: tenant.id,
      userId: owner.id,
      role: "OWNER",
      active: true
    }
  });

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      status: "TRIALING",
      planCode: "starter",
      billingStatus: "PENDING",
      recurrence: "MONTHLY",
      recurrenceMonths: 1,
      monthlyAmount: 1999,
      lastPaymentDate: now,
      lastPaymentPeriodFrom: new Date(now.getFullYear(), now.getMonth(), 1),
      lastPaymentPeriodTo: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      lastPaymentAmount: 1999,
      nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1)
    }
  });

  const cakes = await prisma.productCategory.create({
    data: { tenantId: tenant.id, name: "Cakes", description: "Celebration cakes" }
  });
  const breads = await prisma.productCategory.create({
    data: { tenantId: tenant.id, name: "Breads", description: "Daily bakery breads" }
  });

  const [truffleCake, sourdough, croissant] = await Promise.all([
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: cakes.id,
        name: "Chocolate Truffle Cake",
        category: "Cakes",
        unitPrice: 850,
        taxRate: 5,
        stockOnHand: 12
      }
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: breads.id,
        name: "Sourdough Loaf",
        category: "Breads",
        unitPrice: 180,
        taxRate: 5,
        stockOnHand: 40
      }
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: breads.id,
        name: "Butter Croissant Box",
        category: "Breads",
        unitPrice: 420,
        taxRate: 5,
        stockOnHand: 24
      }
    })
  ]);

  const vehicleUser = await prisma.user.create({
    data: {
      email: credentials.vehicle.email,
      name: "Sweet Crust Vehicle",
      phone: credentials.vehicle.phone,
      passwordHash: vehicleHash
    }
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      tenantId: tenant.id,
      userId: vehicleUser.id,
      name: "Delivery Van 1",
      number: "RJ-14-DEMO-01",
      driverName: "Ravi Driver",
      driverPhone: credentials.vehicle.phone,
      active: true
    }
  });

  const route = await prisma.route.create({
    data: {
      tenantId: tenant.id,
      vehicleId: vehicle.id,
      name: "Morning City Route",
      active: true
    }
  });

  const customerUser = await prisma.user.create({
    data: {
      email: credentials.customer.email,
      name: "Aarav Customer",
      phone: credentials.customer.phone,
      passwordHash: customerHash
    }
  });

  const customer = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      userId: customerUser.id,
      routeId: route.id,
      name: "Aarav Customer",
      email: credentials.customer.email,
      phone: credentials.customer.phone,
      address: "Demo customer address",
      city: "Jaipur",
      state: "Rajasthan",
      creditLimit: 5000,
      tags: ["portal", "demo"]
    }
  });

  await prisma.customerProductPrice.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      productId: truffleCake.id,
      price: 800,
      notes: "Demo preferred customer price"
    }
  });

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      routeId: route.id,
      source: "STAFF_CREATED",
      status: "CONFIRMED",
      paymentStatus: "PARTIAL",
      fulfillmentType: "DELIVERY",
      dueAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      subtotal: 1280,
      taxTotal: 64,
      grandTotal: 1344,
      notes: "Demo delivery order",
      items: {
        create: [
          {
            productId: truffleCake.id,
            name: truffleCake.name,
            quantity: 1,
            unitPrice: 800,
            taxRate: 5,
            lineTotal: 840
          },
          {
            productId: croissant.id,
            name: croissant.name,
            quantity: 1,
            unitPrice: 420,
            taxRate: 5,
            lineTotal: 441
          }
        ]
      },
      payments: {
        create: {
          tenantId: tenant.id,
          amount: 500,
          method: "Cash",
          reference: "DEMO-ADVANCE",
          paidAt: now
        }
      }
    }
  });

  await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      orderId: order.id,
      invoiceNumber: "INV-DEMO-001",
      paymentStatus: "PARTIAL",
      total: 1344
    }
  });

  const flour = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      name: "Premium Flour",
      category: "Raw Material",
      unit: "kg",
      stockOnHand: 100,
      reorderAt: 25,
      unitPrice: 42
    }
  });

  await prisma.inventoryLedger.create({
    data: {
      tenantId: tenant.id,
      itemId: flour.id,
      type: "IN",
      quantity: 100,
      unitPrice: 42,
      totalAmount: 4200,
      note: "Opening stock"
    }
  });

  const supplier = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: "Demo Flour Supplier",
      phone: "+919800000301",
      email: "supplier@example.local",
      address: "Wholesale market"
    }
  });

  await prisma.purchase.create({
    data: {
      tenantId: tenant.id,
      supplierId: supplier.id,
      itemId: flour.id,
      quantity: 100,
      unitPrice: 42,
      amount: 4200,
      paidAmount: 2000,
      paymentStatus: "PARTIAL",
      notes: "Demo flour purchase"
    }
  });

  const chef = await prisma.labour.create({
    data: {
      tenantId: tenant.id,
      name: "Ramesh Chef",
      phone: "+919800000401",
      skill: "Cake finishing",
      dailyWage: 850,
      monthlySalary: 22000,
      notes: "Demo senior chef"
    }
  });

  await prisma.attendance.create({
    data: {
      tenantId: tenant.id,
      userId: owner.id,
      labourId: chef.id,
      workDate: today,
      status: "PRESENT",
      notes: "Demo attendance"
    }
  });

  await prisma.salaryPayment.create({
    data: {
      tenantId: tenant.id,
      userId: owner.id,
      labourId: chef.id,
      amount: 5000,
      period: "July 2026",
      paymentType: "ADVANCE",
      reason: "Demo advance",
      method: "Cash",
      paidAt: today
    }
  });

  await prisma.expense.create({
    data: {
      tenantId: tenant.id,
      routeId: route.id,
      type: "DELIVERY",
      category: "Fuel",
      status: "PAID",
      amount: 700,
      notes: "Demo route fuel expense",
      spentAt: today
    }
  });

  return {
    tenantSlug: tenant.slug,
    counts: {
      platformAdmins: await prisma.platformAdmin.count(),
      tenants: await prisma.tenant.count(),
      users: await prisma.user.count(),
      customers: await prisma.customer.count(),
      vehicles: await prisma.vehicle.count(),
      products: await prisma.product.count(),
      orders: await prisma.order.count()
    }
  };
}

async function main() {
  console.log(JSON.stringify({ targetHost: url.hostname, targetDatabase: url.pathname.replace("/", "") }));
  await clearDatabase();
  const result = await seedDemo();
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  console.log("Credentials:");
  console.log(`Platform admin: ${credentials.platformAdmin.email} / ${credentials.platformAdmin.password}`);
  console.log(`Bakery owner: ${credentials.bakeryOwner.email} / ${credentials.bakeryOwner.password}`);
  console.log(`Customer: ${credentials.customer.email} / ${credentials.customer.password}`);
  console.log(`Customer phone login: ${credentials.customer.phone} / ${credentials.customer.password}`);
  console.log(`Vehicle: ${credentials.vehicle.email} / ${credentials.vehicle.password}`);
  console.log(`Vehicle phone login: ${credentials.vehicle.phone} / ${credentials.vehicle.password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
