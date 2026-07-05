import { prisma } from "../../db/prisma.js";
import { Prisma } from "@prisma/client";
import { pagination, paginationMeta, type PaginationInput } from "../../utils/pagination.js";
import type { CustomerInput, CustomerUpdateInput } from "./customers.schemas.js";

export type CustomerListFilters = PaginationInput & {
  search?: string;
};

export const customersRepository = {
  findRoute(tenantId: string, routeId: string) {
    return prisma.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
  },

  async listByTenant(tenantId: string, filters: CustomerListFilters = {}) {
    const { page, pageSize, skip } = pagination(filters);
    const search = filters.search?.trim();
    const where = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
              { aadhaarNumber: { contains: search, mode: "insensitive" as const } },
              { city: { contains: search, mode: "insensitive" as const } },
              { state: { contains: search, mode: "insensitive" as const } },
              { route: { name: { contains: search, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { route: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.customer.count({ where })
    ]);
    return { customers, pagination: paginationMeta(total, page, pageSize) };
  },

  async financialSummaryByCustomer(tenantId: string, customerIds?: string[]) {
    if (customerIds && !customerIds.length) return new Map<string, { orderTotal: number; paidTotal: number }>();
    const rows = await prisma.$queryRaw<Array<{ customerId: string; orderTotal: unknown; paidTotal: unknown }>>`
      SELECT
        o."customerId" AS "customerId",
        COALESCE(SUM(o."grandTotal"), 0) AS "orderTotal",
        COALESCE(SUM(payment_totals."paidTotal"), 0) AS "paidTotal"
      FROM "Order" o
      LEFT JOIN (
        SELECT p."orderId", SUM(p.amount) AS "paidTotal"
        FROM "Payment" p
        JOIN "Order" po ON po.id = p."orderId"
        WHERE p."tenantId" = ${tenantId} AND p."orderId" IS NOT NULL
          ${customerIds?.length ? Prisma.sql`AND po."customerId" IN (${Prisma.join(customerIds)})` : Prisma.empty}
        GROUP BY p."orderId"
      ) payment_totals ON payment_totals."orderId" = o.id
      WHERE o."tenantId" = ${tenantId}
        ${customerIds?.length ? Prisma.sql`AND o."customerId" IN (${Prisma.join(customerIds)})` : Prisma.empty}
      GROUP BY o."customerId"
    `;
    return new Map(rows.map((row) => [
      row.customerId,
      {
        orderTotal: Number(row.orderTotal || 0),
        paidTotal: Number(row.paidTotal || 0)
      }
    ]));
  },

  findById(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { tenantId, id: customerId },
      include: {
        route: true,
        orders: {
          include: { items: true, payments: true, invoice: true },
          orderBy: { createdAt: "desc" }
        },
        productPrices: { include: { product: true }, orderBy: { updatedAt: "desc" } }
      }
    });
  },

  findByUser(tenantId: string, userId: string) {
    return prisma.customer.findFirst({
      where: { tenantId, userId },
      include: {
        route: true,
        orders: {
          include: { items: true, payments: true, invoice: true },
          orderBy: { createdAt: "desc" }
        },
        productPrices: { include: { product: true }, orderBy: { updatedAt: "desc" } }
      }
    });
  },

  upsertPortalUser(input: { email: string; name: string; phone: string; passwordHash: string }) {
    return prisma.user.upsert({
      where: { email: input.email },
      update: { name: input.name, phone: input.phone, passwordHash: input.passwordHash },
      create: input
    });
  },

  create(tenantId: string, input: CustomerInput & { userId?: string }) {
    return prisma.customer.create({
      data: {
        ...input,
        routeId: input.routeId || undefined,
        tenantId
      },
      include: { route: true }
    });
  },

  update(tenantId: string, customerId: string, input: CustomerUpdateInput & { userId?: string }) {
    return prisma.customer.update({
      where: { id: customerId },
      data: {
        ...input,
        routeId: input.routeId || undefined
      },
      include: { route: true }
    });
  }
};
