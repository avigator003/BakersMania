import { prisma } from "../../db/prisma.js";
import { pagination, paginationMeta, type PaginationInput } from "../../utils/pagination.js";
import type { CategoryInput, CustomerPriceInput, ProductInput, ProductUpdateInput } from "./catalog.schemas.js";

export type ProductListFilters = PaginationInput & {
  includeInactive?: boolean;
  search?: string;
};

export type PriceHistoryFilters = PaginationInput;

export const catalogRepository = {
  findCategory(tenantId: string, categoryId: string) {
    return prisma.productCategory.findFirst({ where: { id: categoryId, tenantId }, select: { id: true, name: true } });
  },

  findProduct(tenantId: string, productId: string) {
    return prisma.product.findFirst({ where: { id: productId, tenantId }, select: { id: true } });
  },

  findProductDetail(tenantId: string, productId: string) {
    return prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: {
        categoryRef: true,
        customerPrices: {
          include: { customer: { include: { route: true } } },
          orderBy: { createdAt: "desc" }
        }
      }
    });
  },

  async listPriceHistory(tenantId: string, productId: string, filters: PriceHistoryFilters = {}) {
    const { page, pageSize, skip } = pagination(filters);
    const where = { tenantId, productId };
    const [history, total] = await Promise.all([
      prisma.customerProductPriceHistory.findMany({
        where,
        include: { customer: { include: { route: true } }, product: true },
        orderBy: { changedAt: "desc" },
        skip,
        take: pageSize
      }),
      prisma.customerProductPriceHistory.count({ where })
    ]);
    return { history, pagination: paginationMeta(total, page, pageSize) };
  },

  findCustomer(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } });
  },

  listCategories(tenantId: string) {
    return prisma.productCategory.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } }
    });
  },

  createCategory(tenantId: string, input: CategoryInput) {
    return prisma.productCategory.create({ data: { ...input, tenantId } });
  },

  async listProducts(tenantId: string, filters: ProductListFilters = {}) {
    const { page, pageSize, skip } = pagination(filters);
    const search = filters.search?.trim();
    const where = {
      tenantId,
      ...(filters.includeInactive ? {} : { active: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              { categoryRef: { name: { contains: search, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: { categoryRef: true },
        skip,
        take: pageSize
      }),
      prisma.product.count({ where })
    ]);
    return { products, pagination: paginationMeta(total, page, pageSize) };
  },

  async createProduct(tenantId: string, input: ProductInput) {
    const category = input.categoryId
      ? await prisma.productCategory.findFirst({ where: { id: input.categoryId, tenantId } })
      : input.category
        ? await prisma.productCategory.upsert({
            where: { tenantId_name: { tenantId, name: input.category } },
            update: {},
            create: { tenantId, name: input.category }
          })
        : null;

    return prisma.product.create({
      data: {
        tenantId,
        name: input.name,
        categoryId: category?.id,
        category: category?.name || input.category || "General",
        description: input.description,
        unitPrice: input.unitPrice,
        taxRate: input.taxRate,
        active: input.active
      },
      include: {
        categoryRef: true,
        customerPrices: { include: { customer: { include: { route: true } } } }
      }
    });
  },

  async updateProduct(tenantId: string, productId: string, input: ProductUpdateInput) {
    const category = input.categoryId
      ? await prisma.productCategory.findFirst({ where: { id: input.categoryId, tenantId } })
      : null;
    return prisma.product.update({
      where: { id: productId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}),
        ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(category ? { categoryId: category.id, category: category.name } : {})
      },
      include: {
        categoryRef: true,
        customerPrices: { include: { customer: { include: { route: true } } } }
      }
    });
  },

  upsertCustomerPrice(tenantId: string, input: CustomerPriceInput) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.customerProductPrice.findUnique({
        where: {
          tenantId_productId_customerId: {
            tenantId,
            productId: input.productId,
            customerId: input.customerId
          }
        }
      });
      const customerPrice = await tx.customerProductPrice.upsert({
        where: {
          tenantId_productId_customerId: {
            tenantId,
            productId: input.productId,
            customerId: input.customerId
          }
        },
        update: { price: input.price, notes: input.notes },
        create: { ...input, tenantId },
        include: {
          product: true,
          customer: { include: { route: true } }
        }
      });
      if (!existing || Number(existing.price) !== Number(input.price)) {
        await tx.customerProductPriceHistory.create({
          data: {
            tenantId,
            productId: input.productId,
            customerId: input.customerId,
            oldPrice: existing?.price,
            newPrice: input.price
          }
        });
      }
      return customerPrice;
    });
  }
};
