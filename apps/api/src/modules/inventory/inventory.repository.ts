import { prisma } from "../../db/prisma.js";
import type { InventoryItemInput, InventoryLedgerInput, ProductStockAdjustmentInput } from "./inventory.schemas.js";

export type ProductStockFilters = {
  categoryId?: string;
  date?: string;
  month?: string;
};

function resolveRequirementRange(filters: ProductStockFilters) {
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  if (filters.month) {
    const start = new Date(`${filters.month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export const inventoryRepository = {
  listItems(tenantId: string) {
    return prisma.inventoryItem.findMany({
      where: { tenantId },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        ledger: {
          orderBy: { happenedAt: "desc" },
          take: 5
        }
      }
    });
  },

  createItem(tenantId: string, input: InventoryItemInput) {
    return prisma.inventoryItem.create({
      data: {
        tenantId,
        name: input.name,
        category: input.category,
        description: input.description,
        unit: input.unit,
        stockOnHand: input.stockOnHand,
        reorderAt: input.reorderAt,
        unitPrice: input.unitPrice
      },
      include: { ledger: true }
    });
  },

  findItem(tenantId: string, itemId: string) {
    return prisma.inventoryItem.findFirst({ where: { id: itemId, tenantId } });
  },

  listItemLedger(tenantId: string, itemId: string) {
    return prisma.inventoryLedger.findMany({
      where: { tenantId, itemId },
      orderBy: { happenedAt: "desc" },
      take: 100
    });
  },

  adjustItem(tenantId: string, input: InventoryLedgerInput) {
    const totalAmount = input.unitPrice !== undefined ? input.unitPrice * input.quantity : undefined;
    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.update({
        where: { id: input.itemId },
        data: {
          stockOnHand: input.type === "BUY" ? { increment: input.quantity } : { decrement: input.quantity },
          ...(input.type === "BUY" && input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {})
        }
      });
      const ledger = await tx.inventoryLedger.create({
        data: {
          tenantId,
          itemId: input.itemId,
          type: input.type,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          totalAmount,
          note: input.note,
          happenedAt: input.happenedAt
        }
      });
      return { item, ledger };
    });
  },

  async listProductStock(tenantId: string, filters: ProductStockFilters) {
    const { start, end } = resolveRequirementRange(filters);
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        ...(filters.categoryId && filters.categoryId !== "all" ? { categoryId: filters.categoryId } : {})
      },
      include: { categoryRef: true },
      orderBy: [{ active: "desc" }, { name: "asc" }]
    });

    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        status: { not: "COMPLETED" },
        OR: [
          { dueAt: { gte: start, lt: end } },
          { dueAt: null, createdAt: { gte: start, lt: end } }
        ]
      },
      select: { items: { select: { productId: true, quantity: true } } }
    });

    const requiredByProductId = new Map<string, number>();
    orders.forEach((order) => {
      order.items.forEach((item) => {
        requiredByProductId.set(item.productId, (requiredByProductId.get(item.productId) || 0) + Number(item.quantity));
      });
    });

    return products.map((product) => {
      const stockOnHand = Number(product.stockOnHand);
      const requiredQuantity = requiredByProductId.get(product.id) || 0;
      return {
        ...product,
        stockOnHand,
        requiredQuantity,
        availableAfterOrders: stockOnHand - requiredQuantity,
        stockStatus: stockOnHand <= 0 ? "OUT" : stockOnHand < requiredQuantity ? "SHORT" : "OK"
      };
    });
  },

  findProduct(tenantId: string, productId: string) {
    return prisma.product.findFirst({ where: { id: productId, tenantId }, select: { id: true, stockOnHand: true } });
  },

  adjustProductStock(tenantId: string, input: ProductStockAdjustmentInput) {
    return prisma.product.update({
      where: { id: input.productId },
      data: {
        stockOnHand: input.mode === "SET" ? input.quantity : { increment: input.quantity },
        stockUpdatedAt: new Date()
      },
      include: { categoryRef: true }
    });
  }
};
