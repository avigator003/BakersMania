import { prisma } from "../../db/prisma.js";

export const reportsRepository = {
  getDashboardData(tenantId: string) {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

    return Promise.all([
      prisma.order.findMany({
        where: { tenantId, status: { not: "COMPLETED" } },
        include: { customer: { include: { route: true } }, route: true, payments: true, items: { include: { product: true } } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 100
      }),
      prisma.inventoryItem.findMany({ where: { tenantId } }),
      prisma.product.findMany({ where: { tenantId, active: true }, select: { id: true, name: true, stockOnHand: true } }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.labour.count({ where: { tenantId, active: true } }),
      prisma.attendance.findMany({
        where: { tenantId, workDate: { gte: start, lt: end } },
        select: { labourId: true, status: true }
      }),
      prisma.expense.findMany({
        where: { tenantId, spentAt: { gte: monthStart, lt: monthEnd } },
        include: { route: true },
        orderBy: { spentAt: "desc" }
      }),
      prisma.purchase.findMany({
        where: { tenantId, purchasedAt: { gte: monthStart, lt: monthEnd } },
        include: { supplier: true, item: true },
        orderBy: { purchasedAt: "desc" }
      }),
      prisma.purchasePayment.findMany({
        where: { tenantId, paidAt: { gte: monthStart, lt: monthEnd } },
        include: { supplier: true, purchase: { include: { item: true } } },
        orderBy: { paidAt: "desc" }
      }),
      prisma.payment.findMany({
        where: { tenantId, paidAt: { gte: monthStart, lt: monthEnd } },
        include: { order: { include: { customer: { include: { route: true } } } } },
        orderBy: { paidAt: "desc" }
      }),
      prisma.inventoryLedger.findMany({
        where: { tenantId, happenedAt: { gte: monthStart, lt: monthEnd } },
        include: { item: true },
        orderBy: { happenedAt: "desc" }
      }),
      prisma.order.findMany({
        where: {
          tenantId,
          status: { not: "CANCELED" },
          OR: [
            { dueAt: { gte: monthStart, lt: monthEnd } },
            { dueAt: null, createdAt: { gte: monthStart, lt: monthEnd } }
          ]
        },
        select: {
          id: true,
          dueAt: true,
          createdAt: true,
          grandTotal: true
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }]
      })
    ]);
  }
};
