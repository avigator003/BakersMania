import { prisma } from "../../db/prisma.js";
import type { CustomerInput, CustomerUpdateInput } from "./customers.schemas.js";

export const customersRepository = {
  findRoute(tenantId: string, routeId: string) {
    return prisma.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
  },

  listByTenant(tenantId: string) {
    return prisma.customer.findMany({
      where: { tenantId },
      include: {
        route: true,
        orders: {
          select: {
            grandTotal: true,
            payments: { select: { amount: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
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

  update(tenantId: string, customerId: string, input: CustomerUpdateInput) {
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
