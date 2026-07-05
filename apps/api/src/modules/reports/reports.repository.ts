import { prisma } from "../../db/prisma.js";

export const reportsRepository = {
  async getDashboardData(tenantId: string) {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

    const [
      activeOrders,
      lowRawMaterialRows,
      products,
      customers,
      activeLabours,
      todayAttendance,
      expenseGroups,
      rawMaterialExpenses,
      sellerPayments,
      customerPayments,
      materialLedgerGroups,
      salesRows,
      ordersDue,
      pendingPaymentRows
    ] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId, status: { not: "COMPLETED" } },
        include: { customer: { include: { route: true } }, route: true, payments: true, items: { include: { product: true } } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 100
      }),
      prisma.$queryRaw<Array<{ count: unknown }>>`
        SELECT COUNT(*) AS count
        FROM "InventoryItem"
        WHERE "tenantId" = ${tenantId}
          AND "stockOnHand" <= "reorderAt"
      `,
      prisma.product.findMany({ where: { tenantId, active: true }, select: { id: true, name: true, stockOnHand: true } }),
      prisma.customer.count({ where: { tenantId } }),
      prisma.labour.count({ where: { tenantId, active: true } }),
      prisma.attendance.findMany({
        where: { tenantId, workDate: { gte: start, lt: end } },
        select: { labourId: true, status: true }
      }),
      prisma.expense.groupBy({
        by: ["status", "type"],
        where: { tenantId, spentAt: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true }
      }),
      prisma.purchase.aggregate({
        where: { tenantId, purchasedAt: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true }
      }),
      prisma.purchasePayment.aggregate({
        where: { tenantId, paidAt: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { tenantId, paidAt: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true }
      }),
      prisma.inventoryLedger.groupBy({
        by: ["type"],
        where: { tenantId, happenedAt: { gte: monthStart, lt: monthEnd } },
        _sum: { quantity: true, totalAmount: true }
      }),
      prisma.$queryRaw<Array<{ day: number; sales: unknown; orders: unknown }>>`
        SELECT EXTRACT(DAY FROM COALESCE("dueAt", "createdAt"))::int AS day,
               COALESCE(SUM("grandTotal"), 0) AS sales,
               COUNT(*)::int AS orders
        FROM "Order"
        WHERE "tenantId" = ${tenantId}
          AND status <> 'CANCELED'
          AND (
            ("dueAt" >= ${monthStart} AND "dueAt" < ${monthEnd})
            OR ("dueAt" IS NULL AND "createdAt" >= ${monthStart} AND "createdAt" < ${monthEnd})
          )
        GROUP BY day
      `,
      prisma.order.count({
        where: { tenantId, status: { notIn: ["COMPLETED", "CANCELED"] } }
      }),
      prisma.$queryRaw<Array<{ pending: unknown }>>`
        SELECT COALESCE(SUM(o."grandTotal" - COALESCE(payment_totals.paid, 0)), 0) AS pending
        FROM "Order" o
        LEFT JOIN (
          SELECT "orderId", SUM(amount) AS paid
          FROM "Payment"
          WHERE "tenantId" = ${tenantId} AND "orderId" IS NOT NULL
          GROUP BY "orderId"
        ) payment_totals ON payment_totals."orderId" = o.id
        WHERE o."tenantId" = ${tenantId}
          AND o.status NOT IN ('COMPLETED', 'CANCELED')
      `
    ]);

    return {
      activeOrders,
      lowRawMaterials: Number(lowRawMaterialRows[0]?.count || 0),
      products,
      customers,
      activeLabours,
      todayAttendance,
      expenseGroups,
      rawMaterialExpenses: Number(rawMaterialExpenses._sum.amount || 0),
      sellerPayments: Number(sellerPayments._sum.amount || 0),
      customerPayments: Number(customerPayments._sum.amount || 0),
      materialLedgerGroups,
      salesRows,
      ordersDue,
      pendingPaymentsAmount: Number(pendingPaymentRows[0]?.pending || 0)
    };
  }
};
