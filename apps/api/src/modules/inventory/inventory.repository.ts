import { prisma } from "../../db/prisma.js";
import { Prisma } from "@prisma/client";
import { pagination, paginationMeta, type PaginationInput } from "../../utils/pagination.js";
import type { InventoryItemInput, InventoryLedgerInput, ProductStockAdjustmentInput } from "./inventory.schemas.js";

export type ProductStockFilters = PaginationInput & {
  categoryId?: string;
  date?: string;
  month?: string;
  search?: string;
};

export type InventoryItemFilters = PaginationInput & {
  category?: string;
  search?: string;
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
  async listItems(tenantId: string, filters: InventoryItemFilters = {}) {
    const { page, pageSize, skip } = pagination(filters);
    const search = filters.search?.trim();
    const where = {
      tenantId,
      ...(filters.category && filters.category !== "all" ? { category: filters.category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const [items, total, summaryRows, categories] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        orderBy: [{ category: "asc" }, { name: "asc" }],
        include: { ledger: { orderBy: { happenedAt: "desc" }, take: 5 } },
        skip,
        take: pageSize
      }),
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.findMany({ where, select: { stockOnHand: true, unitPrice: true, reorderAt: true } }),
      prisma.inventoryItem.findMany({
        where: { tenantId },
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" }
      })
    ]);
    const summary = summaryRows.reduce(
      (totals, item) => {
        const stock = Number(item.stockOnHand || 0);
        totals.stock += stock;
        totals.value += stock * Number(item.unitPrice || 0);
        totals.low += Number(item.reorderAt || 0) > 0 && stock <= Number(item.reorderAt || 0) ? 1 : 0;
        return totals;
      },
      { stock: 0, value: 0, low: 0 }
    );
    return {
      items,
      pagination: paginationMeta(total, page, pageSize),
      summary,
      categories: categories.map((item) => item.category).filter(Boolean)
    };
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
    const { page, pageSize, skip } = pagination(filters);
    const search = filters.search?.trim();
    const where = {
      tenantId,
      ...(filters.categoryId && filters.categoryId !== "all" ? { categoryId: filters.categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
              { categoryRef: { name: { contains: search, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };
    const [products, total, summaryProducts] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { categoryRef: true },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        skip,
        take: pageSize
      }),
      prisma.product.count({ where }),
      prisma.product.findMany({ where, select: { id: true, stockOnHand: true } })
    ]);
    const productIds = products.map((product) => product.id);

    const requirementRows = productIds.length
      ? await prisma.$queryRaw<Array<{ productId: string; requiredQuantity: unknown }>>`
          SELECT oi."productId" AS "productId", COALESCE(SUM(oi.quantity), 0) AS "requiredQuantity"
          FROM "OrderItem" oi
          JOIN "Order" o ON o.id = oi."orderId"
          WHERE o."tenantId" = ${tenantId}
            AND o.status <> 'COMPLETED'
            AND oi."productId" IN (${Prisma.join(productIds)})
            AND (
              (o."dueAt" >= ${start} AND o."dueAt" < ${end})
              OR (o."dueAt" IS NULL AND o."createdAt" >= ${start} AND o."createdAt" < ${end})
            )
          GROUP BY oi."productId"
        `
      : [];
    const requiredByProductId = new Map(requirementRows.map((row) => [row.productId, Number(row.requiredQuantity || 0)]));
    const productRows = products.map((product) => {
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
    const summary = summaryProducts.reduce(
      (totals, product) => {
        totals.stock += Number(product.stockOnHand || 0);
        return totals;
      },
      { stock: 0, required: productRows.reduce((sum, product) => sum + product.requiredQuantity, 0), short: productRows.filter((product) => product.stockStatus !== "OK").length }
    );
    return { products: productRows, pagination: paginationMeta(total, page, pageSize), summary };
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
