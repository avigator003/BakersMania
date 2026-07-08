import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const databaseUrl = process.env.DATABASE_URL || "";
const targetUrl = new URL(databaseUrl);
const targetDatabase = targetUrl.pathname.replace("/", "");

if (process.env.IMPORT_CLOUD_DB !== "YES") {
  throw new Error("Refusing to import without IMPORT_CLOUD_DB=YES");
}

if (targetDatabase !== "neondb") {
  throw new Error(`Refusing to import into unexpected database: ${targetDatabase}`);
}

const exportPath = process.env.MONGO_EXPORT_PATH || "/tmp/bakersmania-mongo-export.json";
const sourceMongoUri = process.env.SOURCE_MONGO_URI || "";
const tenantSlug = process.env.TENANT_SLUG || "star-bakery";
const prisma = new PrismaClient();

const legacyCollections = [
  "categories",
  "vehicles",
  "users",
  "products",
  "orders",
  "stocks",
  "rawmaterialcategories",
  "rawmaterials",
  "sellers",
  "rawmaterialbills",
  "labour",
  "rents",
  "expenses"
];

const oid = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
};

const prefixedId = (prefix, value) => `${prefix}_${oid(value)}`;

const dateValue = (value, fallback = new Date()) => {
  if (!value) return fallback;
  if (value instanceof Date) return value;
  if (value.$date) return new Date(value.$date);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const legacyDayMonthYear = (value, fallback = new Date()) => {
  const raw = stringValue(value);
  const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return dateValue(value, fallback);
  const [, day, month, year] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
};

const numberValue = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const stringValue = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const normalizePhone = (value) => {
  const raw = stringValue(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
};

const safeName = (value, fallback) => stringValue(value, fallback) || fallback;

const normalizeStatus = (status) => {
  const value = stringValue(status).toLowerCase();
  if (value.includes("cancel")) return "CANCELED";
  if (value.includes("pending")) return "PENDING";
  if (value.includes("dispatch")) return "DISPATCHED";
  if (value.includes("ready")) return "READY";
  if (value.includes("complete") || value.includes("paid")) return "COMPLETED";
  return "CONFIRMED";
};

const normalizePaymentStatus = (status, paidAmount, grandTotal) => {
  const value = stringValue(status).toLowerCase();
  if (value.includes("partial")) return "PARTIAL";
  if (value.includes("paid") && !value.includes("unpaid")) return "PAID";
  if (numberValue(paidAmount) > 0 && numberValue(paidAmount) < numberValue(grandTotal)) return "PARTIAL";
  if (numberValue(paidAmount) >= numberValue(grandTotal) && numberValue(grandTotal) > 0) return "PAID";
  return "UNPAID";
};

const monthFromDate = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const createMany = async (model, data, size = 1000) => {
  let count = 0;
  for (const part of chunk(data, size)) {
    if (!part.length) continue;
    const result = await model.createMany({ data: part, skipDuplicates: true });
    count += result.count;
  }
  return count;
};

const loadSource = async () => {
  if (!sourceMongoUri) {
    return JSON.parse(readFileSync(exportPath, "utf8"));
  }

  let MongoClient;
  try {
    ({ MongoClient } = await import("mongodb"));
  } catch {
    throw new Error("SOURCE_MONGO_URI requires the mongodb package. Run npm install mongodb first.");
  }

  const client = new MongoClient(sourceMongoUri);
  await client.connect();
  try {
    const db = client.db(process.env.SOURCE_MONGO_DB || undefined);
    const source = {};
    for (const collectionName of legacyCollections) {
      source[collectionName] = await db.collection(collectionName).find({}).toArray();
    }
    return source;
  } finally {
    await client.close();
  }
};

const deleteTenantGraph = async (tenantId) => {
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
    await tx.routeProductPrice.deleteMany({ where: { tenantId } });
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
};

const main = async () => {
  if (tenantSlug !== "star-bakery" && process.env.ALLOW_NON_STAR_TENANT !== "YES") {
    throw new Error(`Refusing to import unexpected tenant slug: ${tenantSlug}`);
  }

  const source = await loadSource();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const adminPassword = "Admin@123456";
  const ownerEmail = "owner@starbakery.local";
  const ownerPassword = "Star@123456";
  const customerPassword = "123456";
  const vehiclePassword = "123456";

  const [adminHash, ownerHash, customerHash, vehicleHash] = await Promise.all([
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash(ownerPassword, 12),
    bcrypt.hash(customerPassword, 12),
    bcrypt.hash(vehiclePassword, 12)
  ]);

  const sourceCounts = Object.fromEntries(legacyCollections.map((collectionName) => [collectionName, source[collectionName]?.length || 0]));
  const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, name: true, slug: true } });
  console.log(JSON.stringify({
    targetHost: targetUrl.hostname,
    targetDatabase,
    tenantSlug,
    source: sourceMongoUri ? "mongo" : exportPath,
    sourceCounts,
    existingTenant
  }, null, 2));

  if (process.env.DRY_RUN === "YES") {
    return;
  }

  if (existingTenant) {
    await deleteTenantGraph(existingTenant.id);
  }

  await prisma.platformAdmin.upsert({
    where: { email: "admin@bakersmania.local" },
    update: {
      name: "Platform Admin",
      passwordHash: adminHash
    },
    create: {
      email: "admin@bakersmania.local",
      name: "Platform Admin",
      passwordHash: adminHash
    }
  });

  const tenant = await prisma.tenant.create({
    data: {
      name: "Star Bakery",
      slug: tenantSlug,
      status: "TRIALING",
      ownerEmail,
      phone: "+919999999999",
      address: "Migrated from legacy bakery MongoDB"
    }
  });

  const owner = await prisma.user.create({
    data: {
      email: ownerEmail,
      name: "Star Bakery Owner",
      phone: "+919999999999",
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
      planCode: "legacy-import",
      billingStatus: "PENDING",
      recurrence: "MONTHLY",
      recurrenceMonths: 1,
      monthlyAmount: 0,
      lastPaymentDate: now,
      lastPaymentPeriodFrom: new Date(now.getFullYear(), now.getMonth(), 1),
      lastPaymentPeriodTo: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1)
    }
  });

  const categoryIdByMongoId = new Map();
  const productCategoryRows = (source.categories || [])
    .filter((item) => oid(item._id) && stringValue(item.category_name))
    .map((item) => {
      const id = prefixedId("cat", item._id);
      categoryIdByMongoId.set(oid(item._id), id);
      return {
        id,
        tenantId: tenant.id,
        name: safeName(item.category_name, "Legacy"),
        description: stringValue(item.category_description) || null,
        active: true,
        createdAt: dateValue(item.created_at, now),
        updatedAt: dateValue(item.updated_at, now)
      };
    });
  await createMany(prisma.productCategory, productCategoryRows);

  const vehicleByNumber = new Map();
  const explicitVehicles = (source.vehicles || [])
    .filter((item) => stringValue(item.vehicle_no))
    .map((item) => {
      const number = stringValue(item.vehicle_no);
      const id = prefixedId("veh", item._id);
      vehicleByNumber.set(number.toLowerCase(), id);
      return {
        id,
        tenantId: tenant.id,
        name: number,
        number,
        rcExpiryDate: item.rc_expire_date ? dateValue(item.rc_expire_date, now) : null,
        pucExpiryDate: item.puc_expire_date ? dateValue(item.puc_expire_date, now) : null,
        insuranceExpiryDate: item.inc_expire_date ? dateValue(item.inc_expire_date, now) : null,
        fitnessExpiryDate: item.fitness_expire_date ? dateValue(item.fitness_expire_date, now) : null,
        active: stringValue(item.vehicle_status).toLowerCase() !== "stopped",
        createdAt: dateValue(item.created_at, now),
        updatedAt: dateValue(item.updated_at, now)
      };
    });

  const userVehicleRows = [];
  const vehicleUserRows = [];
  for (const item of source.users || []) {
    const number = stringValue(item.vehicle_number);
    if (!number || vehicleByNumber.has(number.toLowerCase())) continue;
    const id = prefixedId("veh_user", item._id);
    const userId = prefixedId("driver", item._id);
    vehicleByNumber.set(number.toLowerCase(), id);
    vehicleUserRows.push({
      id: userId,
      email: `vehicle+${oid(item._id)}@starbakery.local`,
      name: safeName(item.user_name, number),
      phone: normalizePhone(item.mobile_number),
      passwordHash: vehicleHash,
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    });
    userVehicleRows.push({
      id,
      tenantId: tenant.id,
      userId,
      name: number,
      number,
      driverName: safeName(item.user_name, number),
      driverPhone: normalizePhone(item.mobile_number),
      active: true,
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    });
  }

  await createMany(prisma.user, vehicleUserRows, 500);
  await createMany(prisma.vehicle, [...explicitVehicles, ...userVehicleRows]);

  const routeIdByName = new Map();
  const routeRows = [];
  for (const item of source.users || []) {
    const routeName = safeName(item.route_name, safeName(item.user_name, "Legacy Route"));
    const key = routeName.toLowerCase();
    if (routeIdByName.has(key)) continue;
    const vehicleId = vehicleByNumber.get(stringValue(item.vehicle_number).toLowerCase()) || null;
    const id = `route_${routeRows.length + 1}`;
    routeIdByName.set(key, id);
    routeRows.push({
      id,
      tenantId: tenant.id,
      vehicleId,
      name: routeName,
      active: true,
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    });
  }
  await createMany(prisma.route, routeRows);

  const customerIdByMongoId = new Map();
  const customerUsers = [];
  const customerRows = [];
  for (const item of source.users || []) {
    if (!oid(item._id)) continue;
    const customerId = prefixedId("cust", item._id);
    const userId = prefixedId("portal", item._id);
    const email = `customer+${oid(item._id)}@starbakery.local`;
    customerIdByMongoId.set(oid(item._id), customerId);
    customerUsers.push({
      id: userId,
      email,
      name: safeName(item.user_name, "Legacy Customer"),
      phone: normalizePhone(item.mobile_number),
      passwordHash: customerHash,
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    });
    customerRows.push({
      id: customerId,
      tenantId: tenant.id,
      userId,
      routeId: routeIdByName.get(safeName(item.route_name, safeName(item.user_name, "Legacy Route")).toLowerCase()) || null,
      name: safeName(item.user_name, "Legacy Customer"),
      email,
      phone: normalizePhone(item.mobile_number),
      aadhaarNumber: stringValue(item.adhar_number) || null,
      address: stringValue(item.address) || null,
      state: stringValue(item.state) || null,
      city: stringValue(item.city) || null,
      creditLimit: 0,
      tags: [stringValue(item.user_type, "legacy").replace(/\s+/g, " ").trim()],
      notes: stringValue(item.vehicle_number) ? `Legacy vehicle number: ${stringValue(item.vehicle_number)}` : null,
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    });
  }

  const defaultCustomerUser = {
    id: "portal_star_default_customer",
    email: "customer@starbakery.local",
    name: "Star Bakery Test Customer",
    phone: "+919800000101",
    passwordHash: customerHash,
    createdAt: now,
    updatedAt: now
  };
  const defaultVehicleUser = {
    id: "portal_star_default_vehicle",
    email: "vehicle@starbakery.local",
    name: "Star Bakery Test Vehicle",
    phone: "+919800000201",
    passwordHash: vehicleHash,
    createdAt: now,
    updatedAt: now
  };

  await createMany(prisma.user, [defaultCustomerUser, defaultVehicleUser, ...customerUsers], 500);

  if (customerRows[0]) {
    customerRows[0].userId = defaultCustomerUser.id;
    customerRows[0].email = defaultCustomerUser.email;
    customerRows[0].phone = defaultCustomerUser.phone;
  }
  await createMany(prisma.customer, customerRows, 500);

  const firstVehicle = await prisma.vehicle.findFirst({
    where: { tenantId: tenant.id, routes: { some: { active: true } } },
    orderBy: { createdAt: "asc" }
  });
  if (firstVehicle) {
    await prisma.vehicle.update({
      where: { id: firstVehicle.id },
      data: {
        userId: defaultVehicleUser.id,
        driverName: firstVehicle.driverName || defaultVehicleUser.name,
        driverPhone: firstVehicle.driverPhone || defaultVehicleUser.phone
      }
    });
  }

  const productRows = [];
  const productIdByMongoId = new Map();
  const defaultPriceByProductId = new Map();
  for (const item of source.products || []) {
    if (!oid(item._id) || !stringValue(item.product_name)) continue;
    const id = prefixedId("prod", item._id);
    const prices = Array.isArray(item.prices) ? item.prices.map((entry) => numberValue(entry.price, 0)).filter((price) => price > 0) : [];
    const unitPrice = prices.length ? Math.min(...prices) : 0;
    const categoryId = categoryIdByMongoId.get(oid(item.product_category)) || null;
    const categoryName = productCategoryRows.find((category) => category.id === categoryId)?.name || "Legacy";
    productIdByMongoId.set(oid(item._id), id);
    defaultPriceByProductId.set(id, unitPrice);
    productRows.push({
      id,
      tenantId: tenant.id,
      categoryId,
      name: safeName(item.product_name, "Legacy Product"),
      category: categoryName,
      description: stringValue(item.product_description) || null,
      unitPrice,
      stockOnHand: 0,
      taxRate: 0,
      active: true,
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    });
  }
  await createMany(prisma.product, productRows, 500);

  const customerPriceRows = [];
  const priceSeen = new Set();
  for (const item of source.products || []) {
    const productId = productIdByMongoId.get(oid(item._id));
    if (!productId || !Array.isArray(item.prices)) continue;
    for (const priceGroup of item.prices) {
      const price = numberValue(priceGroup.price);
      if (!price || !Array.isArray(priceGroup.users)) continue;
      for (const userRef of priceGroup.users) {
        const customerId = customerIdByMongoId.get(oid(userRef));
        if (!customerId) continue;
        const key = `${productId}:${customerId}`;
        if (priceSeen.has(key)) continue;
        priceSeen.add(key);
        customerPriceRows.push({
          id: `cpp_${productId}_${customerId}`.slice(0, 190),
          tenantId: tenant.id,
          productId,
          customerId,
          price,
          notes: "Migrated legacy customer price",
          createdAt: now,
          updatedAt: now
        });
      }
    }
  }
  await createMany(prisma.customerProductPrice, customerPriceRows, 1000);

  const orderRows = [];
  const orderItemRows = [];
  const invoiceRows = [];
  const paymentRows = [];
  let skippedOrders = 0;
  let skippedOrderItems = 0;
  const customerPriceLookup = new Map(customerPriceRows.map((row) => [`${row.customerId}:${row.productId}`, numberValue(row.price)]));
  for (const item of source.orders || []) {
    const customerId = customerIdByMongoId.get(oid(item.user));
    if (!customerId) {
      skippedOrders += 1;
      continue;
    }
    const orderId = prefixedId("ord", item._id);
    const routeId = customerRows.find((customer) => customer.id === customerId)?.routeId || null;
    const paidAmount = numberValue(item.paidAmount);
    const grandTotal = numberValue(item.totalAmount, numberValue(item.totalPrice));
    const orderDate = dateValue(item.orderDate || item.created_at, now);
    orderRows.push({
      id: orderId,
      tenantId: tenant.id,
      customerId,
      routeId,
      source: "STAFF_CREATED",
      status: normalizeStatus(item.status),
      paymentStatus: normalizePaymentStatus(item.paymentStatus, paidAmount, grandTotal),
      fulfillmentType: "DELIVERY",
      dueAt: orderDate,
      subtotal: numberValue(item.totalPrice, grandTotal),
      taxTotal: 0,
      discountTotal: 0,
      grandTotal,
      notes: item.previousOrderDueAmount !== undefined ? `Legacy previous due: ${numberValue(item.previousOrderDueAmount)}` : null,
      createdAt: dateValue(item.created_at, orderDate),
      updatedAt: dateValue(item.updated_at, orderDate)
    });

    let itemIndex = 0;
    for (const orderProduct of item.products || []) {
      const productId = productIdByMongoId.get(oid(orderProduct.product));
      if (!productId) {
        skippedOrderItems += 1;
        continue;
      }
      itemIndex += 1;
      const quantity = numberValue(orderProduct.quantity, 1);
      const unitPrice = customerPriceLookup.get(`${customerId}:${productId}`) || defaultPriceByProductId.get(productId) || 0;
      orderItemRows.push({
        id: `${orderId}_item_${itemIndex}`,
        orderId,
        productId,
        name: productRows.find((product) => product.id === productId)?.name || "Legacy Product",
        quantity,
        unitPrice,
        taxRate: 0,
        lineTotal: quantity * unitPrice
      });
    }

    invoiceRows.push({
      id: `inv_${oid(item._id)}`,
      tenantId: tenant.id,
      orderId,
      invoiceNumber: `MONGO-${stringValue(item.invoiceNumber, oid(item._id))}-${oid(item._id).slice(-6)}`,
      paymentStatus: normalizePaymentStatus(item.paymentStatus, paidAmount, grandTotal),
      total: grandTotal,
      createdAt: dateValue(item.created_at, orderDate),
      updatedAt: dateValue(item.updated_at, orderDate)
    });

    if (paidAmount > 0) {
      paymentRows.push({
        id: `pay_${oid(item._id)}`,
        tenantId: tenant.id,
        orderId,
        invoiceId: `inv_${oid(item._id)}`,
        amount: paidAmount,
        method: "Legacy",
        reference: stringValue(item.invoiceNumber) ? `Invoice ${stringValue(item.invoiceNumber)}` : null,
        paidAt: dateValue(item.updated_at || item.orderDate, orderDate)
      });
    }
  }

  await createMany(prisma.order, orderRows, 1000);
  await createMany(prisma.orderItem, orderItemRows, 2000);
  await createMany(prisma.invoice, invoiceRows, 1000);
  await createMany(prisma.payment, paymentRows, 1000);

  const stockByProductId = new Map();
  for (const item of source.stocks || []) {
    const productId = productIdByMongoId.get(oid(item.product));
    if (!productId) continue;
    stockByProductId.set(productId, (stockByProductId.get(productId) || 0) + numberValue(item.quantity));
  }
  for (const [productId, stockOnHand] of stockByProductId) {
    await prisma.product.update({
      where: { id: productId },
      data: { stockOnHand, stockUpdatedAt: now }
    });
  }

  const inventoryRows = [];
  const inventoryLedgerRows = [];
  const inventoryIdByMongoId = new Map();
  const rawMaterialCategoryById = new Map(
    (source.rawmaterialcategories || [])
      .filter((item) => oid(item._id) && stringValue(item.name))
      .map((item) => [oid(item._id), stringValue(item.name)])
  );
  for (const item of source.rawmaterials || []) {
    if (!oid(item._id) || !stringValue(item.raw_material_name)) continue;
    const id = prefixedId("invitem", item._id);
    inventoryIdByMongoId.set(oid(item._id), id);
    inventoryRows.push({
      id,
      tenantId: tenant.id,
      name: safeName(item.raw_material_name, "Legacy Raw Material"),
      category: rawMaterialCategoryById.get(oid(Array.isArray(item.category) ? item.category[0] : item.category)) || "Raw Material",
      description: stringValue(item.raw_material_description) || null,
      unit: stringValue(item.quantity_type, "unit") || "unit",
      stockOnHand: numberValue(item.total_quantity),
      reorderAt: numberValue(item.raw_material_min_quantity),
      unitPrice: null,
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    });
    let historyIndex = 0;
    for (const history of item.history || []) {
      historyIndex += 1;
      const quantity = numberValue(history.quantity);
      if (!quantity) continue;
      inventoryLedgerRows.push({
        id: `${id}_ledger_${historyIndex}`,
        tenantId: tenant.id,
        itemId: id,
        type: stringValue(history.history_type, "ADJUSTMENT"),
        quantity,
        note: "Migrated raw material history",
        happenedAt: dateValue(history.created_at, dateValue(item.created_at, now)),
        createdAt: dateValue(history.created_at, dateValue(item.created_at, now)),
        updatedAt: dateValue(history.created_at, dateValue(item.created_at, now))
      });
    }
  }
  await createMany(prisma.inventoryItem, inventoryRows, 500);
  await createMany(prisma.inventoryLedger, inventoryLedgerRows, 1000);

  const supplierRows = (source.sellers || [])
    .filter((item) => oid(item._id) && stringValue(item.seller_name))
    .map((item) => ({
      id: prefixedId("sup", item._id),
      tenantId: tenant.id,
      name: safeName(item.seller_name, "Legacy Supplier"),
      phone: normalizePhone(item.contactNo),
      email: stringValue(item.email) || null,
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    }));
  await createMany(prisma.supplier, supplierRows, 500);

  const supplierByName = new Map(supplierRows.map((supplier) => [supplier.name.toLowerCase(), supplier.id]));
  const fallbackSupplier = supplierRows[0]?.id || (await prisma.supplier.create({
    data: { tenantId: tenant.id, name: "Legacy Supplier" }
  })).id;

  const purchaseRows = (source.rawmaterialbills || [])
    .filter((item) => oid(item._id))
    .map((item) => {
      const amount = numberValue(item.amount);
      const status = stringValue(item.bill_type).toLowerCase().includes("paid") && !stringValue(item.bill_type).toLowerCase().includes("unpaid") ? "PAID" : "UNPAID";
      return {
        id: prefixedId("pur", item._id),
        tenantId: tenant.id,
        supplierId: supplierByName.get(stringValue(item.seller_name).toLowerCase()) || fallbackSupplier,
        amount,
        paidAmount: status === "PAID" ? amount : 0,
        paymentStatus: status,
        notes: `Legacy bill seller: ${stringValue(item.seller_name, "unknown")}`,
        purchasedAt: dateValue(item.raw_material_bill_Date_time || item.created_at, now),
        createdAt: dateValue(item.created_at, now),
        updatedAt: dateValue(item.updated_at, now)
      };
    });
  await createMany(prisma.purchase, purchaseRows, 500);

  const labourRows = (source.labour || [])
    .filter((item) => oid(item._id) && stringValue(item.labour_name))
    .map((item) => ({
      id: prefixedId("lab", item._id),
      tenantId: tenant.id,
      name: safeName(item.labour_name, "Legacy Labour"),
      phone: normalizePhone(item.mobile_number),
      role: "LABOURER",
      skill: null,
      dailyWage: null,
      monthlySalary: numberValue(item.salary) || null,
      active: stringValue(item.status).toLowerCase() !== "inactive",
      joinedAt: dateValue(item.created_at, now),
      notes: `Legacy due: ${numberValue(item.dueAmount)}; payable: ${numberValue(item.payableAmount)}`,
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    }));
  await createMany(prisma.labour, labourRows, 500);

  const attendanceRows = [];
  const salaryRows = [];
  for (const item of source.labour || []) {
    const labourId = prefixedId("lab", item._id);
    let attendanceIndex = 0;
    for (const attendance of item.attendance_history || []) {
      attendanceIndex += 1;
      attendanceRows.push({
        id: `${labourId}_att_${attendanceIndex}`,
        tenantId: tenant.id,
        userId: owner.id,
        labourId,
        workDate: dateValue(attendance.date || attendance.created_at || item.updated_at, now),
        status: stringValue(attendance.status, "PRESENT").toUpperCase(),
        notes: "Migrated attendance",
        createdAt: dateValue(attendance.created_at || item.updated_at, now),
        updatedAt: dateValue(attendance.created_at || item.updated_at, now)
      });
    }
    let salaryIndex = 0;
    for (const salary of item.salary_history || []) {
      if (Array.isArray(salary.advance_payment) && salary.advance_payment.length) {
        for (const advance of salary.advance_payment) {
          salaryIndex += 1;
          const amount = numberValue(advance.amount);
          if (!amount) continue;
          salaryRows.push({
            id: `${labourId}_sal_${oid(salary._id)}_${oid(advance._id) || salaryIndex}`,
            tenantId: tenant.id,
            userId: owner.id,
            labourId,
            amount,
            period: stringValue(salary.created_at || salary.month || salary.period, "Legacy"),
            paymentType: "ADVANCE",
            method: "Legacy",
            paidAt: legacyDayMonthYear(advance.date, dateValue(item.updated_at, now)),
            notes: `Migrated salary history status: ${stringValue(salary.status, "Legacy")}`,
            createdAt: legacyDayMonthYear(advance.date, dateValue(item.updated_at, now)),
            updatedAt: legacyDayMonthYear(advance.date, dateValue(item.updated_at, now))
          });
        }
        continue;
      }
      salaryIndex += 1;
      const amount = numberValue(salary.amount || salary.salary || salary.payableAmount);
      if (!amount) continue;
      salaryRows.push({
        id: `${labourId}_sal_${salaryIndex}`,
        tenantId: tenant.id,
        userId: owner.id,
        labourId,
        amount,
        period: stringValue(salary.month || salary.period, "Legacy"),
        paymentType: stringValue(salary.payment_type || salary.type, "FULL").toUpperCase(),
        method: stringValue(salary.method) || null,
        paidAt: dateValue(salary.date || salary.created_at || item.updated_at, now),
        notes: "Migrated salary history",
        createdAt: dateValue(salary.created_at || item.updated_at, now),
        updatedAt: dateValue(salary.created_at || item.updated_at, now)
      });
    }
  }
  await createMany(prisma.attendance, attendanceRows, 1000);
  await createMany(prisma.salaryPayment, salaryRows, 1000);

  const routeByLowerName = new Map(routeRows.map((route) => [route.name.toLowerCase(), route.id]));
  const expenseRows = [];
  for (const item of source.rents || []) {
    if (!oid(item._id)) continue;
    const routeName = Array.isArray(item.user) ? "" : stringValue(item.user);
    const amount = numberValue(item.amount);
    expenseRows.push({
      id: prefixedId("rent", item._id),
      tenantId: tenant.id,
      routeId: routeByLowerName.get(routeName.toLowerCase()) || null,
      type: "RENT",
      category: routeName ? `Rent - ${routeName}` : "Rent",
      status: stringValue(item.rent_status).toLowerCase().includes("paid") && !stringValue(item.rent_status).toLowerCase().includes("unpaid") ? "PAID" : "PENDING",
      amount,
      notes: "Migrated legacy rent",
      spentAt: dateValue(item.rent_Date_time || item.created_at, now),
      periodMonth: monthFromDate(dateValue(item.rent_Date_time || item.created_at, now)),
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    });
  }
  for (const item of source.expenses || []) {
    if (!oid(item._id)) continue;
    expenseRows.push({
      id: prefixedId("exp", item._id),
      tenantId: tenant.id,
      type: stringValue(item.expense_type, "MISCELLANEOUS").toUpperCase(),
      category: safeName(item.expense_name, "Legacy Expense"),
      status: stringValue(item.expense_status).toLowerCase().includes("paid") && !stringValue(item.expense_status).toLowerCase().includes("unpaid") ? "PAID" : "PENDING",
      amount: numberValue(item.amount),
      notes: "Migrated legacy expense",
      spentAt: dateValue(item.expense_Date_time || item.created_at, now),
      periodMonth: monthFromDate(dateValue(item.expense_Date_time || item.created_at, now)),
      createdAt: dateValue(item.created_at, now),
      updatedAt: dateValue(item.updated_at, now)
    });
  }
  await createMany(prisma.expense, expenseRows, 500);

  const counts = {
    platformAdmins: await prisma.platformAdmin.count(),
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count(),
    memberships: await prisma.membership.count(),
    customers: await prisma.customer.count(),
    routes: await prisma.route.count(),
    vehicles: await prisma.vehicle.count(),
    categories: await prisma.productCategory.count(),
    products: await prisma.product.count(),
    customerPrices: await prisma.customerProductPrice.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    invoices: await prisma.invoice.count(),
    payments: await prisma.payment.count(),
    rawMaterials: await prisma.inventoryItem.count(),
    inventoryLedgers: await prisma.inventoryLedger.count(),
    suppliers: await prisma.supplier.count(),
    purchases: await prisma.purchase.count(),
    labour: await prisma.labour.count(),
    attendance: await prisma.attendance.count(),
    salaryPayments: await prisma.salaryPayment.count(),
    expenses: await prisma.expense.count()
  };

  console.log(JSON.stringify({
    ok: true,
    tenant: { name: tenant.name, slug: tenant.slug },
    imported: counts,
    skipped: { ordersWithoutCustomer: skippedOrders, orderItemsWithoutProduct: skippedOrderItems },
    credentials: {
      platformAdmin: { email: "admin@bakersmania.local", password: adminPassword },
      bakeryOwner: { email: ownerEmail, password: ownerPassword },
      customer: { email: "customer@starbakery.local", password: customerPassword },
      vehicle: { email: "vehicle@starbakery.local", password: vehiclePassword }
    }
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
