import { prisma } from "../../db/prisma.js";
import { PaymentStatus } from "@prisma/client";
import { pagination, paginationMeta, type PaginationInput } from "../../utils/pagination.js";
import type { PurchaseInput, PurchasePaymentInput, SupplierInput } from "./suppliers.schemas.js";

function resolveMonthRange(month?: string) {
  if (!month) return {};
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { gte: start, lt: end };
}

export type PurchaseListFilters = PaginationInput & {
  month?: string;
  status?: string;
  supplierId?: string;
  search?: string;
};

export const suppliersRepository = {
  list(tenantId: string) {
    return prisma.supplier.findMany({
      where: { tenantId },
      include: {
        purchases: {
          include: { item: true, payments: { orderBy: { paidAt: "desc" }, take: 3 } },
          orderBy: { purchasedAt: "desc" },
          take: 5
        },
        _count: { select: { purchases: true } }
      },
      orderBy: { name: "asc" }
    });
  },

  create(tenantId: string, input: SupplierInput) {
    return prisma.supplier.create({ data: { ...input, tenantId } });
  },

  findSupplier(tenantId: string, supplierId: string) {
    return prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  },

  findItem(tenantId: string, itemId: string) {
    return prisma.inventoryItem.findFirst({ where: { id: itemId, tenantId } });
  },

  findPurchase(tenantId: string, purchaseId: string) {
    return prisma.purchase.findFirst({ where: { id: purchaseId, tenantId } });
  },

  async listPurchases(tenantId: string, filters: PurchaseListFilters) {
    const purchasedAt = resolveMonthRange(filters.month);
    const { page, pageSize, skip } = pagination(filters);
    const search = filters.search?.trim();
    const where = {
      tenantId,
      ...(Object.keys(purchasedAt).length ? { purchasedAt } : {}),
      ...(filters.status && filters.status !== "all" ? { paymentStatus: filters.status as PaymentStatus } : {}),
      ...(filters.supplierId && filters.supplierId !== "all" ? { supplierId: filters.supplierId } : {}),
      ...(search
        ? {
            OR: [
              { notes: { contains: search, mode: "insensitive" as const } },
              { supplier: { name: { contains: search, mode: "insensitive" as const } } },
              { item: { name: { contains: search, mode: "insensitive" as const } } },
              { item: { category: { contains: search, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };
    const [purchases, total, amountAgg, paidAgg] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: {
          supplier: true,
          item: true,
          payments: { orderBy: { paidAt: "desc" } }
        },
        orderBy: { purchasedAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.purchase.count({ where }),
      prisma.purchase.aggregate({ where, _sum: { amount: true } }),
      prisma.purchase.aggregate({ where, _sum: { paidAmount: true } })
    ]);
    const amount = Number(amountAgg._sum.amount || 0);
    const paid = Number(paidAgg._sum.paidAmount || 0);
    return {
      purchases,
      pagination: paginationMeta(total, page, pageSize),
      summary: { amount, paid, due: Math.max(amount - paid, 0) }
    };
  },

  createPurchase(tenantId: string, input: PurchaseInput) {
    const amount = input.amount ?? input.quantity * input.unitPrice;
    const paidAmount = input.paidAmount || 0;
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          tenantId,
          supplierId: input.supplierId,
          itemId: input.itemId,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          amount,
          paidAmount,
          paymentStatus: paidAmount >= amount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID",
          notes: input.notes,
          purchasedAt: input.purchasedAt
        },
        include: { supplier: true, item: true, payments: true }
      });

      await tx.inventoryItem.update({
        where: { id: input.itemId },
        data: {
          stockOnHand: { increment: input.quantity },
          unitPrice: input.unitPrice
        }
      });

      await tx.inventoryLedger.create({
        data: {
          tenantId,
          itemId: input.itemId,
          type: "BUY",
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          totalAmount: amount,
          note: input.notes || `Purchased from ${purchase.supplier.name}`,
          happenedAt: input.purchasedAt
        }
      });

      if (paidAmount > 0) {
        await tx.purchasePayment.create({
          data: {
            tenantId,
            purchaseId: purchase.id,
            supplierId: input.supplierId,
            amount: paidAmount,
            paymentType: input.paymentType || (paidAmount >= amount ? "FULL" : "ADVANCE"),
            method: input.method,
            reference: input.reference,
            note: input.notes,
            paidAt: input.purchasedAt
          }
        });
      }

      return purchase;
    });
  },

  addPayment(tenantId: string, purchaseId: string, input: PurchasePaymentInput) {
    return prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirstOrThrow({ where: { id: purchaseId, tenantId } });
      const nextPaid = Number(purchase.paidAmount) + input.amount;
      const amount = Number(purchase.amount);
      const payment = await tx.purchasePayment.create({
        data: {
          tenantId,
          purchaseId,
          supplierId: purchase.supplierId,
          amount: input.amount,
          paymentType: input.paymentType,
          method: input.method,
          reference: input.reference,
          note: input.note,
          paidAt: input.paidAt
        }
      });
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          paidAmount: nextPaid,
          paymentStatus: nextPaid >= amount ? "PAID" : nextPaid > 0 ? "PARTIAL" : "UNPAID"
        },
        include: { supplier: true, item: true, payments: { orderBy: { paidAt: "desc" } } }
      });
      return { payment, purchase: updatedPurchase };
    });
  }
};
