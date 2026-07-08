import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();
const tenantSlug = process.env.E2E_TENANT_SLUG || "star-bakery";

const credentials = {
  admin: { email: "admin@bakersmania.local", password: "Admin@123456" },
  owner: { email: "owner@starbakery.local", password: "Star@123456" },
  manager: { email: "manager@starbakery.local", password: "Manager@123456" },
  customer: { email: "patel.mart@starbakery.local", phone: "+919810010001", password: "123456" },
  vehicle: { email: "vehicle.maninagar@starbakery.local", phone: "+919820020001", password: "123456" }
};

function todayAt(hour, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function hash(password) {
  return bcrypt.hash(password, 12);
}

async function deleteTenantGraph(tenantId) {
  const [memberships, customers, vehicles] = await Promise.all([
    prisma.membership.findMany({ where: { tenantId }, select: { userId: true } }),
    prisma.customer.findMany({ where: { tenantId }, select: { userId: true } }),
    prisma.vehicle.findMany({ where: { tenantId }, select: { userId: true } })
  ]);
  const userIds = Array.from(new Set([...memberships, ...customers, ...vehicles].map((row) => row.userId).filter(Boolean)));

  await prisma.$transaction(async (tx) => {
    const orders = await tx.order.findMany({ where: { tenantId }, select: { id: true } });
    const orderIds = orders.map((order) => order.id);

    await tx.payment.deleteMany({ where: { tenantId } });
    await tx.invoice.deleteMany({ where: { tenantId } });
    if (orderIds.length) await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await tx.order.deleteMany({ where: { tenantId } });
    await tx.purchasePayment.deleteMany({ where: { tenantId } });
    await tx.purchase.deleteMany({ where: { tenantId } });
    await tx.supplier.deleteMany({ where: { tenantId } });
    await tx.inventoryLedger.deleteMany({ where: { tenantId } });
    await tx.inventoryItem.deleteMany({ where: { tenantId } });
    await tx.expense.deleteMany({ where: { tenantId } });
    await tx.attendance.deleteMany({ where: { tenantId } });
    await tx.salaryPayment.deleteMany({ where: { tenantId } });
    await tx.labour.deleteMany({ where: { tenantId } });
    await tx.customerProductPriceHistory.deleteMany({ where: { tenantId } });
    await tx.customerProductPrice.deleteMany({ where: { tenantId } });
    await tx.customer.deleteMany({ where: { tenantId } });
    await tx.product.deleteMany({ where: { tenantId } });
    await tx.productCategory.deleteMany({ where: { tenantId } });
    await tx.route.deleteMany({ where: { tenantId } });
    await tx.vehicle.deleteMany({ where: { tenantId } });
    await tx.subscription.deleteMany({ where: { tenantId } });
    await tx.auditLog.deleteMany({ where: { tenantId } });
    await tx.membership.deleteMany({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
    if (userIds.length) await tx.user.deleteMany({ where: { id: { in: userIds } } });
  }, { timeout: 30000 });
}

async function main() {
  const existing = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (existing) {
    await deleteTenantGraph(existing.id);
  }

  const [adminHash, ownerHash, managerHash, customerHash, vehicleHash] = await Promise.all([
    hash(credentials.admin.password),
    hash(credentials.owner.password),
    hash(credentials.manager.password),
    hash(credentials.customer.password),
    hash(credentials.vehicle.password)
  ]);

  await prisma.platformAdmin.upsert({
    where: { email: credentials.admin.email },
    update: { name: "Platform Admin", passwordHash: adminHash },
    create: { email: credentials.admin.email, name: "Platform Admin", passwordHash: adminHash }
  });

  const tenant = await prisma.tenant.create({
    data: {
      name: "Star Bakery",
      slug: tenantSlug,
      status: "ACTIVE",
      ownerEmail: credentials.owner.email,
      phone: "+91 79 4012 7788",
      address: "12 Sunrise Market Road, Navrangpura, Ahmedabad, Gujarat"
    }
  });

  const [owner, manager] = await Promise.all([
    prisma.user.create({
      data: {
        email: credentials.owner.email,
        name: "Meera Sharma",
        phone: "+919811110001",
        passwordHash: ownerHash
      }
    }),
    prisma.user.create({
      data: {
        email: credentials.manager.email,
        name: "Rohan Mehta",
        phone: "+919811110002",
        passwordHash: managerHash
      }
    })
  ]);

  await prisma.membership.createMany({
    data: [
      { tenantId: tenant.id, userId: owner.id, role: "OWNER", active: true },
      { tenantId: tenant.id, userId: manager.id, role: "MANAGER", active: true }
    ]
  });

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      status: "ACTIVE",
      planCode: "growth",
      billingStatus: "PAID",
      recurrence: "MONTHLY",
      recurrenceMonths: 1,
      monthlyAmount: 2999,
      lastPaymentDate: todayAt(9),
      lastPaymentPeriodFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      lastPaymentPeriodTo: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      lastPaymentAmount: 2999,
      nextDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
    }
  });

  const categories = await Promise.all([
    prisma.productCategory.create({ data: { tenantId: tenant.id, name: "Breads", description: "Daily breads and pav", active: true } }),
    prisma.productCategory.create({ data: { tenantId: tenant.id, name: "Cakes", description: "Celebration and tea cakes", active: true } }),
    prisma.productCategory.create({ data: { tenantId: tenant.id, name: "Cookies", description: "Cookies and biscuits", active: true } }),
    prisma.productCategory.create({ data: { tenantId: tenant.id, name: "Savouries", description: "Khari, puffs, and snacks", active: true } }),
    prisma.productCategory.create({ data: { tenantId: tenant.id, name: "Pastries", description: "Single-serve pastries and desserts", active: true } }),
    prisma.productCategory.create({ data: { tenantId: tenant.id, name: "Beverage Mixes", description: "Tea-time and cafe mixes", active: true } })
  ]);
  const categoryByName = new Map(categories.map((category) => [category.name, category]));

  const products = await Promise.all([
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Breads").id, category: "Breads", name: "Milk Bread 400g", unitPrice: 45, taxRate: 0, stockOnHand: 120, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Breads").id, category: "Breads", name: "Pav Pack 12 pcs", unitPrice: 60, taxRate: 0, stockOnHand: 90, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Breads").id, category: "Breads", name: "Multigrain Loaf 500g", unitPrice: 85, taxRate: 0, stockOnHand: 55, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Cakes").id, category: "Cakes", name: "Chocolate Truffle Cake 1kg", unitPrice: 850, taxRate: 0, stockOnHand: 14, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Cakes").id, category: "Cakes", name: "Pineapple Fresh Cream Cake 1kg", unitPrice: 720, taxRate: 0, stockOnHand: 10, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Pastries").id, category: "Pastries", name: "Black Forest Pastry", unitPrice: 95, taxRate: 0, stockOnHand: 70, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Pastries").id, category: "Pastries", name: "Butterscotch Pastry", unitPrice: 90, taxRate: 0, stockOnHand: 64, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Cookies").id, category: "Cookies", name: "Jeera Cookies 500g", unitPrice: 180, taxRate: 0, stockOnHand: 45, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Cookies").id, category: "Cookies", name: "Chocolate Chip Cookies 500g", unitPrice: 220, taxRate: 0, stockOnHand: 38, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Savouries").id, category: "Savouries", name: "Methi Khari 500g", unitPrice: 160, taxRate: 0, stockOnHand: 52, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Savouries").id, category: "Savouries", name: "Veg Puff", unitPrice: 35, taxRate: 0, stockOnHand: 110, active: true } }),
    prisma.product.create({ data: { tenantId: tenant.id, categoryId: categoryByName.get("Beverage Mixes").id, category: "Beverage Mixes", name: "Masala Tea Premix 1kg", unitPrice: 280, taxRate: 0, stockOnHand: 24, active: true } })
  ]);
  const productByName = new Map(products.map((product) => [product.name, product]));

  const vehicleUsers = await Promise.all([
    prisma.user.create({ data: { email: credentials.vehicle.email, name: "Vikram Chauhan", phone: credentials.vehicle.phone, passwordHash: vehicleHash } }),
    prisma.user.create({ data: { email: "vehicle.navrangpura@starbakery.local", name: "Imran Shaikh", phone: "+919820020002", passwordHash: vehicleHash } }),
    prisma.user.create({ data: { email: "vehicle.satellite@starbakery.local", name: "Ketan Patel", phone: "+919820020003", passwordHash: vehicleHash } }),
    prisma.user.create({ data: { email: "vehicle.vastrapur@starbakery.local", name: "Harsh Joshi", phone: "+919820020004", passwordHash: vehicleHash } }),
    prisma.user.create({ data: { email: "vehicle.bopal@starbakery.local", name: "Sameer Qureshi", phone: "+919820020005", passwordHash: vehicleHash } })
  ]);

  const vehicles = await Promise.all([
    prisma.vehicle.create({
      data: {
        tenantId: tenant.id,
        userId: vehicleUsers[0].id,
        name: "Maninagar Delivery Van",
        number: "GJ-01-AB-2145",
        driverName: "Vikram Chauhan",
        driverPhone: "+919820020001",
        rcExpiryDate: addDays(new Date(), 8),
        pucExpiryDate: addDays(new Date(), 42),
        insuranceExpiryDate: addDays(new Date(), -2),
        fitnessExpiryDate: addDays(new Date(), 120),
        active: true
      }
    }),
    prisma.vehicle.create({
      data: {
        tenantId: tenant.id,
        userId: vehicleUsers[1].id,
        name: "Navrangpura Retail Van",
        number: "GJ-01-CD-7821",
        driverName: "Imran Shaikh",
        driverPhone: "+919820020002",
        rcExpiryDate: addDays(new Date(), 90),
        pucExpiryDate: addDays(new Date(), 12),
        insuranceExpiryDate: addDays(new Date(), 75),
        fitnessExpiryDate: addDays(new Date(), 180),
        active: true
      }
    }),
    prisma.vehicle.create({
      data: {
        tenantId: tenant.id,
        userId: vehicleUsers[2].id,
        name: "Satellite Cafe Van",
        number: "GJ-01-EF-6390",
        driverName: "Ketan Patel",
        driverPhone: "+919820020003",
        rcExpiryDate: addDays(new Date(), 150),
        pucExpiryDate: addDays(new Date(), 55),
        insuranceExpiryDate: addDays(new Date(), 13),
        fitnessExpiryDate: addDays(new Date(), 210),
        active: true
      }
    }),
    prisma.vehicle.create({
      data: {
        tenantId: tenant.id,
        userId: vehicleUsers[3].id,
        name: "Vastrapur Corporate Van",
        number: "GJ-01-GH-5084",
        driverName: "Harsh Joshi",
        driverPhone: "+919820020004",
        rcExpiryDate: addDays(new Date(), 22),
        pucExpiryDate: addDays(new Date(), 95),
        insuranceExpiryDate: addDays(new Date(), 160),
        fitnessExpiryDate: addDays(new Date(), 240),
        active: true
      }
    }),
    prisma.vehicle.create({
      data: {
        tenantId: tenant.id,
        userId: vehicleUsers[4].id,
        name: "Bopal Bakery Van",
        number: "GJ-01-JK-9132",
        driverName: "Sameer Qureshi",
        driverPhone: "+919820020005",
        rcExpiryDate: addDays(new Date(), 65),
        pucExpiryDate: addDays(new Date(), 9),
        insuranceExpiryDate: addDays(new Date(), 38),
        fitnessExpiryDate: addDays(new Date(), 190),
        active: true
      }
    })
  ]);

  const routes = await Promise.all([
    prisma.route.create({ data: { tenantId: tenant.id, vehicleId: vehicles[0].id, name: "Maninagar Morning Route", active: true } }),
    prisma.route.create({ data: { tenantId: tenant.id, vehicleId: vehicles[1].id, name: "Navrangpura Retail Route", active: true } }),
    prisma.route.create({ data: { tenantId: tenant.id, vehicleId: vehicles[2].id, name: "Satellite Cafe Route", active: true } }),
    prisma.route.create({ data: { tenantId: tenant.id, vehicleId: vehicles[3].id, name: "Vastrapur Corporate Route", active: true } }),
    prisma.route.create({ data: { tenantId: tenant.id, vehicleId: vehicles[4].id, name: "Bopal Evening Route", active: true } })
  ]);

  const customerRows = [
    ["Patel Super Mart", credentials.customer.email, credentials.customer.phone, "Maninagar Morning Route", "Maninagar", "Gujarat", "8 Anand Shopping Centre, Maninagar", 12000],
    ["Sunrise Cafe", "sunrise.cafe@starbakery.local", "+919810010002", "Maninagar Morning Route", "Kankaria", "Gujarat", "Lake Road, Kankaria", 9000],
    ["Jay Ambe Provision Store", "jayambe.provision@starbakery.local", "+919810010007", "Maninagar Morning Route", "Ghodasar", "Gujarat", "Swaminarayan Road, Ghodasar", 8000],
    ["Green Leaf Restaurant", "greenleaf@starbakery.local", "+919810010003", "Navrangpura Retail Route", "Navrangpura", "Gujarat", "CG Road, Navrangpura", 15000],
    ["Krishna Tea House", "krishna.tea@starbakery.local", "+919810010004", "Navrangpura Retail Route", "Usmanpura", "Gujarat", "Ashram Road, Usmanpura", 7000],
    ["Aarav Snacks Corner", "aarav.snacks@starbakery.local", "+919810010008", "Navrangpura Retail Route", "Navrangpura", "Gujarat", "Commerce Six Road, Navrangpura", 6500],
    ["Blue Oven Cafe", "blueoven@starbakery.local", "+919810010005", "Satellite Cafe Route", "Satellite", "Gujarat", "100 Feet Road, Satellite", 18000],
    ["Nisha Party Orders", "nisha.party@starbakery.local", "+919810010006", "Satellite Cafe Route", "Prahlad Nagar", "Gujarat", "Corporate Road, Prahlad Nagar", 10000],
    ["Cafe Magnolia", "cafe.magnolia@starbakery.local", "+919810010009", "Satellite Cafe Route", "Bodakdev", "Gujarat", "Judges Bungalow Road, Bodakdev", 14000],
    ["Shreeji Corporate Pantry", "shreeji.pantry@starbakery.local", "+919810010010", "Vastrapur Corporate Route", "Vastrapur", "Gujarat", "Sunrise Business Park, Vastrapur", 22000],
    ["Urban Bites Office Cafe", "urbanbites.office@starbakery.local", "+919810010011", "Vastrapur Corporate Route", "Vastrapur", "Gujarat", "Alpha One Road, Vastrapur", 16000],
    ["Riverside Banquet Kitchen", "riverside.banquet@starbakery.local", "+919810010012", "Vastrapur Corporate Route", "Ambawadi", "Gujarat", "Near Nehru Bridge, Ambawadi", 28000],
    ["Bopal Fresh Mart", "bopal.freshmart@starbakery.local", "+919810010013", "Bopal Evening Route", "Bopal", "Gujarat", "South Bopal Main Road", 12000],
    ["Anaya Home Bakers", "anaya.homebakers@starbakery.local", "+919810010014", "Bopal Evening Route", "Bopal", "Gujarat", "Gala Gymkhana Road, Bopal", 9000],
    ["Orchid Party Plot", "orchid.partyplot@starbakery.local", "+919810010015", "Bopal Evening Route", "Shela", "Gujarat", "Club O7 Road, Shela", 24000]
  ];
  const routeByName = new Map(routes.map((route) => [route.name, route]));
  const customers = [];
  for (const [name, email, phone, routeName, city, state, address, creditLimit] of customerRows) {
    const user = await prisma.user.create({ data: { email, name, phone, passwordHash: customerHash } });
    const customer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        routeId: routeByName.get(routeName).id,
        name,
        email,
        phone,
        address,
        state,
        city,
        creditLimit,
        tags: ["real-data"],
        notes: `Assigned to ${routeName}`
      },
      include: { route: true }
    });
    customers.push(customer);
  }
  const customerByName = new Map(customers.map((customer) => [customer.name, customer]));

  await prisma.customerProductPrice.createMany({
    data: [
      { tenantId: tenant.id, customerId: customerByName.get("Patel Super Mart").id, productId: productByName.get("Milk Bread 400g").id, price: 40, notes: "Retail counter daily rate" },
      { tenantId: tenant.id, customerId: customerByName.get("Sunrise Cafe").id, productId: productByName.get("Pav Pack 12 pcs").id, price: 54, notes: "Morning cafe rate" },
      { tenantId: tenant.id, customerId: customerByName.get("Green Leaf Restaurant").id, productId: productByName.get("Methi Khari 500g").id, price: 145, notes: "Restaurant bulk rate" },
      { tenantId: tenant.id, customerId: customerByName.get("Blue Oven Cafe").id, productId: productByName.get("Chocolate Truffle Cake 1kg").id, price: 790, notes: "Cafe display cake rate" },
      { tenantId: tenant.id, customerId: customerByName.get("Cafe Magnolia").id, productId: productByName.get("Black Forest Pastry").id, price: 84, notes: "Pastry counter rate" },
      { tenantId: tenant.id, customerId: customerByName.get("Shreeji Corporate Pantry").id, productId: productByName.get("Veg Puff").id, price: 30, notes: "Corporate snack rate" },
      { tenantId: tenant.id, customerId: customerByName.get("Urban Bites Office Cafe").id, productId: productByName.get("Multigrain Loaf 500g").id, price: 76, notes: "Office cafe bread rate" },
      { tenantId: tenant.id, customerId: customerByName.get("Bopal Fresh Mart").id, productId: productByName.get("Chocolate Chip Cookies 500g").id, price: 198, notes: "Retail shelf rate" },
      { tenantId: tenant.id, customerId: customerByName.get("Orchid Party Plot").id, productId: productByName.get("Pineapple Fresh Cream Cake 1kg").id, price: 660, notes: "Event cake rate" },
      { tenantId: tenant.id, customerId: customerByName.get("Riverside Banquet Kitchen").id, productId: productByName.get("Masala Tea Premix 1kg").id, price: 250, notes: "Banquet beverage rate" }
    ]
  });

  await prisma.routeProductPrice.createMany({
    data: [
      { tenantId: tenant.id, routeId: routeByName.get("Maninagar Morning Route").id, productId: productByName.get("Milk Bread 400g").id, price: 42, notes: "Morning retail route bread rate" },
      { tenantId: tenant.id, routeId: routeByName.get("Navrangpura Retail Route").id, productId: productByName.get("Veg Puff").id, price: 32, notes: "Retail snack route rate" },
      { tenantId: tenant.id, routeId: routeByName.get("Satellite Cafe Route").id, productId: productByName.get("Black Forest Pastry").id, price: 88, notes: "Cafe pastry route rate" },
      { tenantId: tenant.id, routeId: routeByName.get("Vastrapur Corporate Route").id, productId: productByName.get("Masala Tea Premix 1kg").id, price: 255, notes: "Corporate pantry route rate" },
      { tenantId: tenant.id, routeId: routeByName.get("Bopal Evening Route").id, productId: productByName.get("Chocolate Chip Cookies 500g").id, price: 205, notes: "Evening retail route rate" }
    ]
  });

  const labour = await Promise.all([
    prisma.labour.create({ data: { tenantId: tenant.id, name: "Anita Parmar", phone: "+919830030001", role: "LABOURER", skill: "Cake finishing", dailyWage: 850, monthlySalary: 22000, active: true } }),
    prisma.labour.create({ data: { tenantId: tenant.id, name: "Mahesh Rathod", phone: "+919830030002", role: "LABOURER", skill: "Oven and bread line", dailyWage: 780, monthlySalary: 20500, active: true } }),
    prisma.labour.create({ data: { tenantId: tenant.id, name: "Farida Khan", phone: "+919830030003", role: "CASHIER", skill: "Billing and packing", dailyWage: 700, monthlySalary: 18500, active: true } })
  ]);
  await prisma.attendance.createMany({
    data: labour.map((person, index) => ({
      tenantId: tenant.id,
      userId: owner.id,
      labourId: person.id,
      workDate: todayAt(0),
      status: index === 2 ? "HALF_DAY" : "PRESENT",
      notes: index === 2 ? "Half shift at counter" : "Regular shift"
    }))
  });
  await prisma.salaryPayment.create({
    data: { tenantId: tenant.id, userId: owner.id, labourId: labour[0].id, amount: 5000, period: "July 2026", paymentType: "ADVANCE", method: "UPI", reference: "SAL-JUL-ANITA" }
  });

  const inventory = await Promise.all([
    prisma.inventoryItem.create({ data: { tenantId: tenant.id, name: "Maida Flour", category: "Raw Material", unit: "kg", stockOnHand: 180, reorderAt: 80, unitPrice: 38 } }),
    prisma.inventoryItem.create({ data: { tenantId: tenant.id, name: "Butter", category: "Dairy", unit: "kg", stockOnHand: 32, reorderAt: 20, unitPrice: 420 } }),
    prisma.inventoryItem.create({ data: { tenantId: tenant.id, name: "Chocolate Compound", category: "Raw Material", unit: "kg", stockOnHand: 18, reorderAt: 25, unitPrice: 260 } })
  ]);
  await prisma.inventoryLedger.createMany({
    data: [
      { tenantId: tenant.id, itemId: inventory[0].id, type: "BUY", quantity: 100, unitPrice: 38, totalAmount: 3800, note: "Opening flour stock" },
      { tenantId: tenant.id, itemId: inventory[1].id, type: "USE", quantity: 4, note: "Cake production" },
      { tenantId: tenant.id, itemId: inventory[2].id, type: "USE", quantity: 3, note: "Truffle cake batch" }
    ]
  });

  const supplier = await prisma.supplier.create({ data: { tenantId: tenant.id, name: "Ahmedabad Baking Supplies", phone: "+917940450101", email: "orders@ahdbakingsupplies.local", address: "Kalupur Market, Ahmedabad" } });
  const purchase = await prisma.purchase.create({
    data: {
      tenantId: tenant.id,
      supplierId: supplier.id,
      itemId: inventory[0].id,
      quantity: 50,
      unitPrice: 38,
      amount: 1900,
      paidAmount: 900,
      paymentStatus: "PARTIAL",
      notes: "Weekly flour purchase"
    }
  });
  await prisma.purchasePayment.create({ data: { tenantId: tenant.id, purchaseId: purchase.id, supplierId: supplier.id, amount: 900, paymentType: "PARTIAL", method: "UPI", reference: "SUP-FLOUR-001" } });

  const orderSpecs = [
    { customer: "Patel Super Mart", items: [["Milk Bread 400g", 40], ["Pav Pack 12 pcs", 12]], status: "DISPATCHED", paid: 1500, method: "Cash", hour: 8 },
    { customer: "Sunrise Cafe", items: [["Pav Pack 12 pcs", 25], ["Veg Puff", 20]], status: "CONFIRMED", paid: 700, method: "UPI", hour: 8 },
    { customer: "Jay Ambe Provision Store", items: [["Milk Bread 400g", 28], ["Jeera Cookies 500g", 8]], status: "PENDING", paid: 0, method: null, hour: 9 },
    { customer: "Green Leaf Restaurant", items: [["Methi Khari 500g", 12], ["Multigrain Loaf 500g", 10]], status: "CONFIRMED", paid: 0, method: null, hour: 10 },
    { customer: "Krishna Tea House", items: [["Jeera Cookies 500g", 18], ["Masala Tea Premix 1kg", 4]], status: "PENDING", paid: 500, method: "Cash", hour: 10 },
    { customer: "Aarav Snacks Corner", items: [["Veg Puff", 35], ["Methi Khari 500g", 6]], status: "DISPATCHED", paid: 800, method: "UPI", hour: 11 },
    { customer: "Blue Oven Cafe", items: [["Chocolate Truffle Cake 1kg", 2], ["Black Forest Pastry", 16]], status: "COMPLETED", paid: 2580, method: "UPI", hour: 12 },
    { customer: "Nisha Party Orders", items: [["Pineapple Fresh Cream Cake 1kg", 3], ["Butterscotch Pastry", 24]], status: "CONFIRMED", paid: 1200, method: "Cash", hour: 12 },
    { customer: "Cafe Magnolia", items: [["Black Forest Pastry", 28], ["Chocolate Chip Cookies 500g", 6]], status: "DISPATCHED", paid: 1800, method: "UPI", hour: 13 },
    { customer: "Shreeji Corporate Pantry", items: [["Veg Puff", 60], ["Masala Tea Premix 1kg", 5]], status: "CONFIRMED", paid: 1400, method: "UPI", hour: 14 },
    { customer: "Urban Bites Office Cafe", items: [["Multigrain Loaf 500g", 18], ["Butterscotch Pastry", 20]], status: "PENDING", paid: 0, method: null, hour: 14 },
    { customer: "Riverside Banquet Kitchen", items: [["Pineapple Fresh Cream Cake 1kg", 5], ["Black Forest Pastry", 40]], status: "DISPATCHED", paid: 3000, method: "Cash", hour: 15 },
    { customer: "Bopal Fresh Mart", items: [["Chocolate Chip Cookies 500g", 10], ["Milk Bread 400g", 24]], status: "CONFIRMED", paid: 900, method: "UPI", hour: 16 },
    { customer: "Anaya Home Bakers", items: [["Methi Khari 500g", 7], ["Jeera Cookies 500g", 9]], status: "PENDING", paid: 0, method: null, hour: 16 },
    { customer: "Orchid Party Plot", items: [["Chocolate Truffle Cake 1kg", 4], ["Pineapple Fresh Cream Cake 1kg", 4], ["Veg Puff", 80]], status: "CONFIRMED", paid: 3500, method: "UPI", hour: 17 }
  ];
  const createdOrders = [];
  for (const spec of orderSpecs) {
    const customer = customerByName.get(spec.customer);
    const orderItems = [];
    for (const [productName, qty] of spec.items) {
      const product = productByName.get(productName);
      const customPrice = await prisma.customerProductPrice.findUnique({
        where: { tenantId_productId_customerId: { tenantId: tenant.id, productId: product.id, customerId: customer.id } }
      });
      const routePrice = await prisma.routeProductPrice.findUnique({
        where: { tenantId_productId_routeId: { tenantId: tenant.id, productId: product.id, routeId: customer.routeId } }
      });
      const unitPrice = Number(customPrice?.price || routePrice?.price || product.unitPrice);
      orderItems.push({ productId: product.id, name: product.name, quantity: qty, unitPrice, taxRate: 0, lineTotal: unitPrice * qty });
    }
    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const paymentStatus = spec.paid <= 0 ? "UNPAID" : spec.paid >= subtotal ? "PAID" : "PARTIAL";
    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        routeId: customer.routeId,
        source: "STAFF_CREATED",
        status: spec.status,
        paymentStatus,
        fulfillmentType: "DELIVERY",
        dueAt: todayAt(spec.hour || 11),
        subtotal,
        taxTotal: 0,
        grandTotal: subtotal,
        notes: "Seeded real-name order",
        items: {
          create: orderItems
        }
      }
    });
    if (spec.paid > 0) {
      await prisma.payment.create({ data: { tenantId: tenant.id, orderId: order.id, amount: spec.paid, method: spec.method, reference: `PAY-${spec.customer.replace(/\W+/g, "-").toUpperCase()}` } });
    }
    createdOrders.push(order);
  }

  const invoiceOrder = createdOrders.find((order) => order.paymentStatus === "PAID");
  if (invoiceOrder) {
    await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        orderId: invoiceOrder.id,
        invoiceNumber: "SB-INV-0001",
        paymentStatus: "PAID",
        total: invoiceOrder.grandTotal
      }
    });
  }

  await prisma.expense.createMany({
    data: [
      { tenantId: tenant.id, routeId: routeByName.get("Maninagar Morning Route").id, type: "RENT", category: "Route Rent", amount: 600, status: "PENDING", spentAt: todayAt(8), notes: "Morning delivery route rent" },
      { tenantId: tenant.id, type: "MISCELLANEOUS", category: "Packaging Material", amount: 1250, status: "PAID", spentAt: todayAt(10), notes: "Cake boxes and bread bags" }
    ]
  });

  const counts = {
    tenants: await prisma.tenant.count({ where: { slug: tenantSlug } }),
    users: await prisma.user.count({ where: { OR: [{ memberships: { some: { tenantId: tenant.id } } }, { customers: { some: { tenantId: tenant.id } } }, { vehicles: { some: { tenantId: tenant.id } } }] } }),
    routes: await prisma.route.count({ where: { tenantId: tenant.id } }),
    vehicles: await prisma.vehicle.count({ where: { tenantId: tenant.id } }),
    customers: await prisma.customer.count({ where: { tenantId: tenant.id } }),
    categories: await prisma.productCategory.count({ where: { tenantId: tenant.id } }),
    products: await prisma.product.count({ where: { tenantId: tenant.id } }),
    customerPrices: await prisma.customerProductPrice.count({ where: { tenantId: tenant.id } }),
    routePrices: await prisma.routeProductPrice.count({ where: { tenantId: tenant.id } }),
    orders: await prisma.order.count({ where: { tenantId: tenant.id } }),
    payments: await prisma.payment.count({ where: { tenantId: tenant.id } }),
    labour: await prisma.labour.count({ where: { tenantId: tenant.id } }),
    inventoryItems: await prisma.inventoryItem.count({ where: { tenantId: tenant.id } })
  };

  console.log(JSON.stringify({
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    credentials,
    counts
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
