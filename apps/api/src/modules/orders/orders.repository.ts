import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { CreateOrderInput } from "./orders.schemas.js";

type OrderListFilters = {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  routeId?: string;
  customerIds?: string[];
  routeIds?: string[];
};

function routeScope(routeIds: string[]): Prisma.OrderWhereInput {
  return {
    OR: [
      { routeId: { in: routeIds } },
      { routeId: null, customer: { routeId: { in: routeIds } } }
    ]
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
  listForStaff(tenantId: string, filters: OrderListFilters = {}) {
    const where: Prisma.OrderWhereInput = { tenantId };
    const andFilters: Prisma.OrderWhereInput[] = [];

    if (filters.customerId && filters.customerId !== "all") {
      andFilters.push({ customerId: filters.customerId });
    }
    if (filters.customerIds?.length) {
      andFilters.push({ customerId: { in: filters.customerIds } });
    }

    if (filters.routeId && filters.routeId !== "all") {
      andFilters.push({
        OR: [{ routeId: filters.routeId }, { routeId: null, customer: { routeId: filters.routeId } }]
      });
    }
    if (filters.routeIds?.length) {
      andFilters.push(routeScope(filters.routeIds));
    }

    if (filters.startDate || filters.endDate) {
      const dateRange: { gte?: Date; lt?: Date } = {};
      if (filters.startDate) {
        dateRange.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
      }
      if (filters.endDate) {
        const end = new Date(`${filters.endDate}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        dateRange.lt = end;
      }
      andFilters.push({
        OR: [
          { dueAt: dateRange },
          { dueAt: null, createdAt: dateRange }
        ]
      });
    }

    if (andFilters.length) {
      where.AND = andFilters;
    }

    return prisma.order.findMany({
      where,
      include: { customer: { include: { route: true } }, route: true, items: true, invoice: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  },

  listForCustomer(tenantId: string, customerId: string) {
    return prisma.order.findMany({
      where: { tenantId, customerId },
      include: { customer: { include: { route: true } }, route: true, items: true, invoice: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  },

  findVehicleRoutes(tenantId: string, vehicleId: string) {
    return prisma.vehicle.findFirst({
      where: { tenantId, id: vehicleId, active: true },
      include: { routes: { where: { active: true }, orderBy: { name: "asc" } } }
    });
  },

  listForVehicle(tenantId: string, routeIds: string[], filters: OrderListFilters = {}) {
    const where: Prisma.OrderWhereInput = { tenantId };
    const andFilters: Prisma.OrderWhereInput[] = [routeScope(routeIds)];

    if (filters.startDate || filters.endDate) {
      const dateRange: { gte?: Date; lt?: Date } = {};
      if (filters.startDate) dateRange.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
      if (filters.endDate) {
        const end = new Date(`${filters.endDate}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        dateRange.lt = end;
      }
      andFilters.push({ OR: [{ dueAt: dateRange }, { dueAt: null, createdAt: dateRange }] });
    }

    if (filters.routeId && filters.routeId !== "all") {
      andFilters.push({ OR: [{ routeId: filters.routeId }, { routeId: null, customer: { routeId: filters.routeId } }] });
    }
    if (filters.routeIds?.length) {
      andFilters.push(routeScope(filters.routeIds));
    }
    if (filters.customerIds?.length) {
      andFilters.push({ customerId: { in: filters.customerIds } });
    }

    where.AND = andFilters;
    return prisma.order.findMany({
      where,
      include: { customer: { include: { route: true } }, route: true, items: true, invoice: true, payments: true },
      orderBy: { createdAt: "asc" },
      take: 100
    });
  },

  findCustomer(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({ where: { tenantId, id: customerId }, include: { route: true } });
  },

  findProducts(tenantId: string, productIds: string[], customerId?: string) {
    return prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      include: customerId ? { customerPrices: { where: { customerId } } } : undefined
    });
  },

  findOrder(tenantId: string, orderId: string) {
    return prisma.order.findFirst({
      where: { tenantId, id: orderId },
      include: { payments: true, invoice: true, customer: true, route: true }
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
        items: {
          where: filters.categoryId && filters.categoryId !== "all" ? { product: { categoryId: filters.categoryId } } : {},
          include: { product: { include: { categoryRef: true } } }
        }
      },
      orderBy: [{ route: { name: "asc" } }, { createdAt: "asc" }]
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
      include: { customer: { include: { route: true } }, route: true, items: true, payments: true, invoice: true },
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
      include: { customer: { include: { route: true } }, route: true, items: true, payments: true, invoice: true },
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

  updateOrderStatus(input: {
    tenantId: string;
    orderId: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    payment?: { amount: number; method: string; reference?: string };
  }) {
    return prisma.$transaction(async (tx) => {
      if (input.payment) {
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
