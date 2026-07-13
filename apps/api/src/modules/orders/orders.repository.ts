import { OrderSource, OrderStatus, PaymentStatus, Prisma, VehicleOrderStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { CreateOrderInput, CustomerPaymentInput } from "./orders.schemas.js";

type OrderListFilters = {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  routeId?: string;
  customerIds?: string[];
  routeIds?: string[];
  search?: string;
  page?: number;
  pageSize?: number;
};

function routeScope(routeIds: string[]): Prisma.OrderWhereInput {
  return {
    OR: [
      { routeId: { in: routeIds } },
      { routeId: null, customer: { routeId: { in: routeIds } } }
    ]
  };
}

function pagination(filters: OrderListFilters) {
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 100, 1), 100);
  const page = Math.max(Number(filters.page) || 1, 1);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function dateRangeFilter(filters: OrderListFilters) {
  if (!filters.startDate && !filters.endDate) return null;
  const dateRange: { gte?: Date; lt?: Date } = {};
  if (filters.startDate) {
    dateRange.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
  }
  if (filters.endDate) {
    const end = new Date(`${filters.endDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    dateRange.lt = end;
  }
  return {
    OR: [
      { dueAt: dateRange },
      { dueAt: null, createdAt: dateRange }
    ]
  } satisfies Prisma.OrderWhereInput;
}

function searchFilter(search?: string) {
  const query = search?.trim();
  if (!query) return null;
  const upperQuery = query.toUpperCase();
  const enumFilters: Prisma.OrderWhereInput[] = [];
  if (Object.values(OrderSource).includes(upperQuery as OrderSource)) {
    enumFilters.push({ source: upperQuery as OrderSource });
  }
  if (Object.values(OrderStatus).includes(upperQuery as OrderStatus)) {
    enumFilters.push({ status: upperQuery as OrderStatus });
  }
  if (Object.values(PaymentStatus).includes(upperQuery as PaymentStatus)) {
    enumFilters.push({ paymentStatus: upperQuery as PaymentStatus });
  }
  return {
    OR: [
      ...enumFilters,
      { customer: { name: { contains: query, mode: "insensitive" } } },
      { customer: { phone: { contains: query, mode: "insensitive" } } },
      { customer: { route: { name: { contains: query, mode: "insensitive" } } } },
      { route: { name: { contains: query, mode: "insensitive" } } }
    ]
  } satisfies Prisma.OrderWhereInput;
}

function buildOrderWhere(tenantId: string, filters: OrderListFilters = {}, baseFilters: Prisma.OrderWhereInput[] = []) {
  const where: Prisma.OrderWhereInput = { tenantId };
  const andFilters: Prisma.OrderWhereInput[] = [...baseFilters];

  if (filters.customerId && filters.customerId !== "all") {
    andFilters.push({ customerId: filters.customerId });
  }
  if (filters.customerIds?.length) {
    andFilters.push({ customerId: { in: filters.customerIds } });
  }

  if (filters.routeId && filters.routeId !== "all") {
    andFilters.push({ OR: [{ routeId: filters.routeId }, { routeId: null, customer: { routeId: filters.routeId } }] });
  }
  if (filters.routeIds?.length) {
    andFilters.push(routeScope(filters.routeIds));
  }

  const dateFilter = dateRangeFilter(filters);
  if (dateFilter) andFilters.push(dateFilter);

  const textFilter = searchFilter(filters.search);
  if (textFilter) andFilters.push(textFilter);

  if (andFilters.length) {
    where.AND = andFilters;
  }
  return where;
}

async function paginatedOrders(where: Prisma.OrderWhereInput, filters: OrderListFilters, orderBy: Prisma.OrderOrderByWithRelationInput | Prisma.OrderOrderByWithRelationInput[]) {
  const { page, pageSize, skip } = pagination(filters);
  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: { customer: { include: { route: true } }, route: true, items: { include: { product: { include: { categoryRef: true } } } }, invoice: true, payments: true },
      orderBy,
      skip,
      take: pageSize
    }),
    prisma.order.count({ where })
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize))
  };
}

type CalculatedOrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
};

export const ordersRepository = {
  async cleanupExpiredPendingOrders(cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    return prisma.$transaction(async (tx) => {
      const expiredOrders = await tx.order.findMany({
        where: {
          status: "PENDING",
          OR: [
            { dueAt: { lt: cutoff } },
            { dueAt: null, createdAt: { lt: cutoff } }
          ]
        },
        select: { id: true }
      });
      const orderIds = expiredOrders.map((order) => order.id);
      if (!orderIds.length) {
        return { deleted: 0 };
      }

      await tx.payment.deleteMany({
        where: {
          OR: [
            { orderId: { in: orderIds } },
            { invoice: { orderId: { in: orderIds } } }
          ]
        }
      });
      await tx.invoice.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      return { deleted: orderIds.length };
    });
  },

  listForStaff(tenantId: string, filters: OrderListFilters = {}) {
    return paginatedOrders(buildOrderWhere(tenantId, filters), filters, { createdAt: "desc" });
  },

  listForCustomer(tenantId: string, customerId: string, filters: OrderListFilters = {}) {
    return paginatedOrders(buildOrderWhere(tenantId, filters, [{ customerId }]), filters, { createdAt: "desc" });
  },

  findVehicleRoutes(tenantId: string, vehicleId: string) {
    return prisma.vehicle.findFirst({
      where: { tenantId, id: vehicleId, active: true },
      include: { routes: { where: { active: true }, orderBy: { name: "asc" } } }
    });
  },

  listForVehicle(tenantId: string, routeIds: string[], filters: OrderListFilters = {}) {
    return paginatedOrders(buildOrderWhere(tenantId, filters, [routeScope(routeIds)]), filters, { createdAt: "asc" });
  },

  findCustomer(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({ where: { tenantId, id: customerId }, include: { route: true } });
  },

  findProducts(tenantId: string, productIds: string[], customerId?: string, routeId?: string | null) {
    return prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      include: {
        ...(customerId ? { customerPrices: { where: { customerId } } } : {}),
        ...(routeId ? { routePrices: { where: { routeId } } } : {})
      }
    });
  },

  findOrder(tenantId: string, orderId: string) {
    return prisma.order.findFirst({
      where: { tenantId, id: orderId },
      include: { payments: true, invoice: true, customer: true, route: true }
    });
  },

  updateVehicleStatus(tenantId: string, orderId: string, vehicleStatus: VehicleOrderStatus) {
    return prisma.order.update({
      where: { id: orderId, tenantId },
      data: { vehicleStatus },
      include: { items: true, customer: { include: { route: true } }, route: true, invoice: true, payments: true }
    });
  },

  findCustomerOrderOnDate(tenantId: string, customerId: string, date: Date, excludeOrderId?: string) {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return prisma.order.findFirst({
      where: {
        tenantId,
        customerId,
        ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
        OR: [
          { dueAt: { gte: start, lt: end } },
          { dueAt: null, createdAt: { gte: start, lt: end } }
        ]
      },
      select: { id: true }
    });
  },

  truckLoading(tenantId: string, filters: { date: string; categoryId?: string; routeIds?: string[] }) {
    const start = new Date(`${filters.date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const andFilters: Prisma.OrderWhereInput[] = [{
      OR: [
        { dueAt: { gte: start, lt: end } },
        { dueAt: null, createdAt: { gte: start, lt: end } }
      ]
    }];
    if (filters.routeIds) {
      andFilters.push(routeScope(filters.routeIds));
    }
    return prisma.order.findMany({
      where: {
        tenantId,
        status: { not: "COMPLETED" },
        AND: andFilters
      },
      include: {
        route: true,
        customer: { include: { route: true } },
        payments: true,
        items: {
          where: filters.categoryId && filters.categoryId !== "all" ? { product: { categoryId: filters.categoryId } } : {},
          include: { product: { include: { categoryRef: true } } }
        }
      },
      orderBy: [{ route: { name: "asc" } }, { createdAt: "asc" }]
    });
  },

  async truckLoadingRouteTotals(tenantId: string, filters: { date: string; routeIds?: string[] }) {
    const start = new Date(`${filters.date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const routeFilter = filters.routeIds?.length
      ? Prisma.sql`AND COALESCE(o."routeId", c."routeId") IN (${Prisma.join(filters.routeIds)})`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<Array<{
      routeId: string;
      previousDue: unknown;
      orderAmount: unknown;
      paidAmount: unknown;
    }>>`
      WITH order_base AS (
        SELECT
          o.id,
          COALESCE(o."routeId", c."routeId") AS "routeId",
          o."grandTotal",
          COALESCE(o."dueAt", o."createdAt") AS "orderDate"
        FROM "Order" o
        JOIN "Customer" c ON c.id = o."customerId"
        WHERE o."tenantId" = ${tenantId}
          AND COALESCE(o."routeId", c."routeId") IS NOT NULL
          ${routeFilter}
      ),
      order_paid AS (
        SELECT
          ob.id,
          COALESCE(SUM(p.amount), 0) AS "paidTotal",
          COALESCE(SUM(CASE WHEN p."paidAt" >= ${start} AND p."paidAt" < ${end} THEN p.amount ELSE 0 END), 0) AS "paidToday"
        FROM order_base ob
        LEFT JOIN "Payment" p ON p."orderId" = ob.id
        GROUP BY ob.id
      ),
      order_due AS (
        SELECT
          ob.*,
          op."paidToday",
          GREATEST(ob."grandTotal" - op."paidTotal", 0) AS "dueAmount"
        FROM order_base ob
        JOIN order_paid op ON op.id = ob.id
      )
      SELECT
        "routeId",
        COALESCE(SUM(CASE WHEN "orderDate" < ${start} THEN "dueAmount" ELSE 0 END), 0) AS "previousDue",
        COALESCE(SUM(CASE WHEN "orderDate" >= ${start} AND "orderDate" < ${end} THEN "grandTotal" ELSE 0 END), 0) AS "orderAmount",
        COALESCE(SUM("paidToday"), 0) AS "paidAmount"
      FROM order_due
      GROUP BY "routeId"
    `;
    return rows.map((row) => {
      const previousDue = Number(row.previousDue || 0);
      const orderAmount = Number(row.orderAmount || 0);
      const paidAmount = Number(row.paidAmount || 0);
      return {
        routeId: row.routeId,
        previousDue,
        orderAmount,
        paidAmount,
        todaysDue: Math.max(previousDue + orderAmount - paidAmount, 0)
      };
    });
  },

  async truckLoadingCustomerTotals(tenantId: string, filters: { date: string; routeIds?: string[] }) {
    const start = new Date(`${filters.date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const routeFilter = filters.routeIds?.length
      ? Prisma.sql`AND c."routeId" IN (${Prisma.join(filters.routeIds)})`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<Array<{
      customerId: string;
      previousDue: unknown;
      orderAmount: unknown;
      paidAmount: unknown;
    }>>`
      WITH order_base AS (
        SELECT
          o.id,
          o."customerId",
          o."grandTotal",
          COALESCE(o."dueAt", o."createdAt") AS "orderDate"
        FROM "Order" o
        JOIN "Customer" c ON c.id = o."customerId"
        WHERE o."tenantId" = ${tenantId}
          ${routeFilter}
      ),
      order_paid AS (
        SELECT
          ob.id,
          COALESCE(SUM(p.amount), 0) AS "paidTotal",
          COALESCE(SUM(CASE WHEN p."paidAt" >= ${start} AND p."paidAt" < ${end} THEN p.amount ELSE 0 END), 0) AS "paidToday"
        FROM order_base ob
        LEFT JOIN "Payment" p ON p."orderId" = ob.id
        GROUP BY ob.id
      ),
      order_due AS (
        SELECT
          ob.*,
          op."paidToday",
          GREATEST(ob."grandTotal" - op."paidTotal", 0) AS "dueAmount"
        FROM order_base ob
        JOIN order_paid op ON op.id = ob.id
      )
      SELECT
        "customerId",
        COALESCE(SUM(CASE WHEN "orderDate" < ${start} THEN "dueAmount" ELSE 0 END), 0) AS "previousDue",
        COALESCE(SUM(CASE WHEN "orderDate" >= ${start} AND "orderDate" < ${end} THEN "grandTotal" ELSE 0 END), 0) AS "orderAmount",
        COALESCE(SUM("paidToday"), 0) AS "paidAmount"
      FROM order_due
      GROUP BY "customerId"
    `;
    return rows.map((row) => {
      const previousDue = Number(row.previousDue || 0);
      const orderAmount = Number(row.orderAmount || 0);
      const paidAmount = Number(row.paidAmount || 0);
      return {
        customerId: row.customerId,
        previousDue,
        orderAmount,
        paidAmount,
        todaysDue: Math.max(previousDue + orderAmount - paidAmount, 0)
      };
    });
  },

  listForDate(tenantId: string, filters: { date: string; routeId?: string }) {
    const start = new Date(`${filters.date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const andFilters: Prisma.OrderWhereInput[] = [{
      OR: [
        { dueAt: { gte: start, lt: end } },
        { dueAt: null, createdAt: { gte: start, lt: end } }
      ]
    }];
    if (filters.routeId && filters.routeId !== "all") {
      andFilters.push({ OR: [{ routeId: filters.routeId }, { routeId: null, customer: { routeId: filters.routeId } }] });
    }
    return prisma.order.findMany({
      where: {
        tenantId,
        status: { not: "COMPLETED" },
        AND: andFilters
      },
      include: { customer: { include: { route: true } }, route: true, items: { include: { product: { include: { categoryRef: true } } } }, payments: true, invoice: true },
      orderBy: { createdAt: "asc" }
    });
  },

  listForRange(tenantId: string, filters: { startDate: string; endDate: string; routeId?: string; routeIds?: string[] }) {
    const start = new Date(`${filters.startDate}T00:00:00.000Z`);
    const end = new Date(`${filters.endDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const andFilters: Prisma.OrderWhereInput[] = [{
      OR: [
        { dueAt: { gte: start, lt: end } },
        { dueAt: null, createdAt: { gte: start, lt: end } }
      ]
    }];
    if (filters.routeId && filters.routeId !== "all") {
      andFilters.push({ OR: [{ routeId: filters.routeId }, { routeId: null, customer: { routeId: filters.routeId } }] });
    }
    if (filters.routeIds) {
      andFilters.push(routeScope(filters.routeIds));
    }
    return prisma.order.findMany({
      where: {
        tenantId,
        AND: andFilters
      },
      include: { customer: { include: { route: true } }, route: true, items: { include: { product: { include: { categoryRef: true } } } }, payments: true, invoice: true },
      orderBy: [{ route: { name: "asc" } }, { createdAt: "asc" }]
    });
  },

  createOrder(input: {
    tenantId: string;
    customerId: string;
    orderInput: Omit<CreateOrderInput, "items" | "customerId">;
    totals: {
      subtotal: number;
      taxTotal: number;
      discountTotal: number;
      grandTotal: number;
    };
    items: CalculatedOrderItem[];
    routeId?: string | null;
  }) {
    return prisma.order.create({
      data: {
        ...input.orderInput,
        tenantId: input.tenantId,
        customerId: input.customerId,
        routeId: input.routeId || undefined,
        ...input.totals,
        items: { create: input.items }
      },
      include: { items: true, customer: { include: { route: true } }, route: true, payments: true }
    });
  },

  updateOrder(input: {
    tenantId: string;
    orderId: string;
    customerId: string;
    orderInput: Omit<CreateOrderInput, "items" | "customerId">;
    totals: {
      subtotal: number;
      taxTotal: number;
      discountTotal: number;
      grandTotal: number;
    };
    items: CalculatedOrderItem[];
    routeId?: string | null;
    paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  }) {
    return prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: input.orderId } });
      return tx.order.update({
        where: { id: input.orderId },
        data: {
          ...input.orderInput,
          customerId: input.customerId,
          routeId: input.routeId || null,
          paymentStatus: input.paymentStatus,
          ...input.totals,
          items: { create: input.items }
        },
        include: { items: true, customer: { include: { route: true } }, route: true, payments: true }
      });
    });
  },

  async customerDaySummary(tenantId: string, customerId: string, date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const rows = await prisma.$queryRaw<Array<{
      previousOrderAmount: unknown;
      previousPaid: unknown;
      todayOrderAmount: unknown;
      todayPaid: unknown;
    }>>`
      WITH order_payments AS (
        SELECT
          o.id,
          o."grandTotal",
          COALESCE(o."dueAt", o."createdAt") AS "orderDate",
          COALESCE(SUM(p.amount), 0) AS paid
        FROM "Order" o
        LEFT JOIN "Payment" p ON p."orderId" = o.id
        WHERE o."tenantId" = ${tenantId}
          AND o."customerId" = ${customerId}
        GROUP BY o.id
      )
      SELECT
        COALESCE(SUM(CASE WHEN "orderDate" < ${start} THEN "grandTotal" ELSE 0 END), 0) AS "previousOrderAmount",
        COALESCE(SUM(CASE WHEN "orderDate" < ${start} THEN paid ELSE 0 END), 0) AS "previousPaid",
        COALESCE(SUM(CASE WHEN "orderDate" >= ${start} AND "orderDate" < ${end} THEN "grandTotal" ELSE 0 END), 0) AS "todayOrderAmount",
        COALESCE(SUM(CASE WHEN "orderDate" >= ${start} AND "orderDate" < ${end} THEN paid ELSE 0 END), 0) AS "todayPaid"
      FROM order_payments
    `;
    const row = rows[0] || { previousOrderAmount: 0, previousPaid: 0, todayOrderAmount: 0, todayPaid: 0 };
    const previousOrderAmount = Number(row.previousOrderAmount || 0);
    const previousPaid = Number(row.previousPaid || 0);
    const todayOrderAmount = Number(row.todayOrderAmount || 0);
    const todayPaid = Number(row.todayPaid || 0);
    const previousDue = Math.max(previousOrderAmount - previousPaid, 0);
    const todaysDue = Math.max(todayOrderAmount - todayPaid, 0);
    return {
      date,
      previousOrderAmount,
      previousPaid,
      previousDue,
      todayOrderAmount,
      todayPaid,
      todaysDue,
      totalDue: previousDue + todaysDue
    };
  },

  async routeInvoiceSummary(tenantId: string, date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const rows = await prisma.$queryRaw<Array<{
      routeId: string;
      routeName: string;
      customerCount: unknown;
      pricedProductCount: unknown;
      orderAmount: unknown;
      oldDue: unknown;
      paidAmount: unknown;
      totalDue: unknown;
    }>>`
      WITH order_base AS (
        SELECT
          o.id,
          COALESCE(o."routeId", c."routeId") AS "routeId",
          o."grandTotal",
          COALESCE(o."dueAt", o."createdAt") AS "orderDate"
        FROM "Order" o
        JOIN "Customer" c ON c.id = o."customerId"
        WHERE o."tenantId" = ${tenantId}
      ),
      order_paid AS (
        SELECT
          ob.id,
          COALESCE(SUM(p.amount), 0) AS "paidTotal",
          COALESCE(SUM(CASE WHEN p."paidAt" >= ${start} AND p."paidAt" < ${end} THEN p.amount ELSE 0 END), 0) AS "paidToday"
        FROM order_base ob
        LEFT JOIN "Payment" p ON p."orderId" = ob.id
        GROUP BY ob.id
      ),
      order_due AS (
        SELECT
          ob.*,
          op."paidTotal",
          op."paidToday",
          GREATEST(ob."grandTotal" - op."paidTotal", 0) AS "dueAmount"
        FROM order_base ob
        JOIN order_paid op ON op.id = ob.id
      ),
      customer_counts AS (
        SELECT "routeId", COUNT(*) AS "customerCount"
        FROM "Customer"
        WHERE "tenantId" = ${tenantId}
          AND "routeId" IS NOT NULL
        GROUP BY "routeId"
      ),
      price_counts AS (
        SELECT "routeId", COUNT(DISTINCT "productId") AS "pricedProductCount"
        FROM "RouteProductPrice"
        WHERE "tenantId" = ${tenantId}
        GROUP BY "routeId"
      ),
      route_totals AS (
        SELECT
          "routeId",
          COALESCE(SUM(CASE WHEN "orderDate" >= ${start} AND "orderDate" < ${end} THEN "grandTotal" ELSE 0 END), 0) AS "orderAmount",
          COALESCE(SUM(CASE WHEN "orderDate" < ${start} THEN "dueAmount" ELSE 0 END), 0) AS "oldDue",
          COALESCE(SUM("paidToday"), 0) AS "paidAmount",
          COALESCE(SUM(CASE WHEN "orderDate" < ${end} THEN "dueAmount" ELSE 0 END), 0) AS "totalDue"
        FROM order_due
        WHERE "routeId" IS NOT NULL
        GROUP BY "routeId"
      )
      SELECT
        r.id AS "routeId",
        r.name AS "routeName",
        COALESCE(cc."customerCount", 0) AS "customerCount",
        COALESCE(pc."pricedProductCount", 0) AS "pricedProductCount",
        COALESCE(rt."orderAmount", 0) AS "orderAmount",
        COALESCE(rt."oldDue", 0) AS "oldDue",
        COALESCE(rt."paidAmount", 0) AS "paidAmount",
        COALESCE(rt."totalDue", 0) AS "totalDue"
      FROM "Route" r
      LEFT JOIN customer_counts cc ON cc."routeId" = r.id
      LEFT JOIN price_counts pc ON pc."routeId" = r.id
      LEFT JOIN route_totals rt ON rt."routeId" = r.id
      WHERE r."tenantId" = ${tenantId}
        AND r.active = true
      ORDER BY r.name ASC
    `;

    const normalizedRows = rows.map((row) => ({
      routeId: row.routeId,
      routeName: row.routeName,
      customerCount: Number(row.customerCount || 0),
      pricedProductCount: Number(row.pricedProductCount || 0),
      orderAmount: Number(row.orderAmount || 0),
      oldDue: Number(row.oldDue || 0),
      paidAmount: Number(row.paidAmount || 0),
      totalDue: Number(row.totalDue || 0)
    }));

    return {
      date,
      totals: {
        routes: normalizedRows.length,
        customers: normalizedRows.reduce((sum, row) => sum + row.customerCount, 0),
        pricedProducts: normalizedRows.reduce((sum, row) => sum + row.pricedProductCount, 0),
        orderAmount: normalizedRows.reduce((sum, row) => sum + row.orderAmount, 0),
        oldDue: normalizedRows.reduce((sum, row) => sum + row.oldDue, 0),
        paidAmount: normalizedRows.reduce((sum, row) => sum + row.paidAmount, 0),
        totalDue: normalizedRows.reduce((sum, row) => sum + row.totalDue, 0)
      },
      rows: normalizedRows
    };
  },

  async recordRoutePayment(tenantId: string, routeId: string, input: { amount: number; method: string; reference?: string }) {
    return prisma.$transaction(async (tx) => {
      const route = await tx.route.findFirst({ where: { id: routeId, tenantId } });
      if (!route) return null;

      const orders = await tx.order.findMany({
        where: {
          tenantId,
          OR: [
            { routeId },
            { routeId: null, customer: { routeId } }
          ]
        },
        include: { payments: true, invoice: true },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }]
      });

      let remaining = input.amount;
      const payments: Array<{ orderId: string; amount: number }> = [];

      for (const order of orders) {
        if (remaining <= 0) break;
        const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const due = Math.max(Number(order.grandTotal || 0) - paid, 0);
        if (due <= 0) continue;

        const amount = Math.min(due, remaining);
        const existingPayment = order.payments[0];
        const nextPaid = existingPayment ? Math.min(Number(order.grandTotal || 0), paid + amount) : amount;
        if (existingPayment) {
          await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              amount: nextPaid,
              method: input.method,
              reference: input.reference,
              paidAt: new Date()
            }
          });
        } else {
          await tx.payment.create({
            data: {
              tenantId,
              orderId: order.id,
              amount,
              method: input.method,
              reference: input.reference
            }
          });
        }

        const paymentStatus: PaymentStatus = nextPaid >= Number(order.grandTotal || 0) ? "PAID" : "PARTIAL";
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus } });
        if (order.invoice) {
          await tx.invoice.update({ where: { id: order.invoice.id }, data: { paymentStatus } });
        }
        payments.push({ orderId: order.id, amount });
        remaining -= amount;
      }

      return {
        route,
        appliedAmount: input.amount - remaining,
        unappliedAmount: remaining,
        payments
      };
    });
  },

  async recordCustomerPayment(tenantId: string, customerId: string, input: CustomerPaymentInput) {
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, tenantId } });
      if (!customer) return null;

      const date = input.date || new Date().toISOString().slice(0, 10);
      const end = new Date(`${date}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      const orderWhere: Prisma.OrderWhereInput = {
        tenantId,
        customerId,
        ...(input.mode === "DUE_FULL" ? {
          OR: [
            { dueAt: { lt: end } },
            { dueAt: null, createdAt: { lt: end } }
          ]
        } : input.orderId ? { id: input.orderId } : {})
      };

      const orders = await tx.order.findMany({
        where: orderWhere,
        include: { payments: true, invoice: true },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }]
      });

      const dueByOrder = orders.map((order) => {
        const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const due = Math.max(Number(order.grandTotal || 0) - paid, 0);
        const existingPayment = order.payments[0];
        const capacity = input.mode === "PARTIAL"
          ? Number(order.grandTotal || 0)
          : existingPayment
            ? due
            : Number(order.grandTotal || 0);
        return { order, paid, due, existingPayment, capacity };
      }).filter((row) => input.mode === "PARTIAL" ? row.capacity > 0 : row.due > 0);

      const computedAmount = input.mode === "DUE_FULL"
        ? dueByOrder.reduce((sum, row) => sum + row.due, 0)
        : dueByOrder[0]?.due || 0;
      let remaining = input.mode === "PARTIAL" ? Number(input.amount || 0) : computedAmount;
      const payments: Array<{ orderId: string; amount: number }> = [];

      for (const { order, paid, due, existingPayment } of dueByOrder) {
        if (remaining <= 0) break;
        const amount = input.mode === "PARTIAL" ? Math.min(Number(order.grandTotal || 0), remaining) : Math.min(due, remaining);
        const nextPaid = input.mode === "PARTIAL" ? amount : Math.min(Number(order.grandTotal || 0), paid + amount);
        if (existingPayment) {
          await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              amount: nextPaid,
              method: input.method,
              reference: input.reference,
              paidAt: new Date()
            }
          });
        } else {
          await tx.payment.create({
            data: {
              tenantId,
              orderId: order.id,
              amount: nextPaid,
              method: input.method,
              reference: input.reference
            }
          });
        }

        const paymentStatus: PaymentStatus = nextPaid >= Number(order.grandTotal || 0) ? "PAID" : "PARTIAL";
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus } });
        if (order.invoice) {
          await tx.invoice.update({ where: { id: order.invoice.id }, data: { paymentStatus } });
        }
        payments.push({ orderId: order.id, amount });
        remaining -= amount;
      }

      return {
        customer,
        requestedAmount: input.mode === "PARTIAL" ? Number(input.amount || 0) : computedAmount,
        appliedAmount: (input.mode === "PARTIAL" ? Number(input.amount || 0) : computedAmount) - remaining,
        unappliedAmount: remaining,
        payments
      };
    });
  },

  updateOrderStatus(input: {
    tenantId: string;
    orderId: string;
    status?: OrderStatus;
    vehicleStatus?: VehicleOrderStatus;
    paymentStatus?: PaymentStatus;
    payment?: { amount: number; method: string; reference?: string };
  }) {
    return prisma.$transaction(async (tx) => {
      if (input.payment) {
        const existingPayment = await tx.payment.findFirst({
          where: { tenantId: input.tenantId, orderId: input.orderId }
        });
        if (existingPayment) {
          await tx.payment.update({
            where: { id: existingPayment.id },
            data: {
              amount: input.payment.amount,
              method: input.payment.method,
              reference: input.payment.reference,
              paidAt: new Date()
            }
          });
        } else {
          await tx.payment.create({
            data: {
              tenantId: input.tenantId,
              orderId: input.orderId,
              amount: input.payment.amount,
              method: input.payment.method,
              reference: input.payment.reference
            }
          });
        }
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: input.orderId },
        include: { payments: true, invoice: true }
      });
      const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const derivedPaymentStatus: PaymentStatus =
        paid >= Number(order.grandTotal) && Number(order.grandTotal) > 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
      const nextPaymentStatus = input.paymentStatus && input.paymentStatus !== "PARTIAL" && input.paymentStatus !== "PAID"
        ? input.paymentStatus
        : derivedPaymentStatus;

      const updated = await tx.order.update({
        where: { id: input.orderId },
        data: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.vehicleStatus ? { vehicleStatus: input.vehicleStatus } : {}),
          paymentStatus: nextPaymentStatus
        },
        include: { items: true, customer: { include: { route: true } }, route: true, invoice: true, payments: true }
      });

      if (updated.invoice) {
        await tx.invoice.update({
          where: { id: updated.invoice.id },
          data: { paymentStatus: nextPaymentStatus }
        });
      }

      return updated;
    });
  }
};
