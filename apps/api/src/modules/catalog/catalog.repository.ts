import { prisma } from "../../db/prisma.js";
import { pagination, paginationMeta, type PaginationInput } from "../../utils/pagination.js";
import type { CategoryInput, CategoryUpdateInput, CustomerPriceInput, ProductInput, ProductUpdateInput, RoutePriceInput } from "./catalog.schemas.js";

export type ProductListFilters = PaginationInput & {
  includeInactive?: boolean;
  customerIdForPreferences?: string;
  search?: string;
  categoryId?: string;
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
        routePrices: {
          include: { route: { include: { vehicle: true } } },
          orderBy: { updatedAt: "desc" }
        },
        customerPrices: {
          include: { customer: { include: { route: true } } },
          orderBy: { updatedAt: "desc" }
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

  findCustomerForPreferenceAccess(tenantId: string, customerId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true, routeId: true }
    });
  },

  findVehicleRoutes(tenantId: string, vehicleId: string) {
    return prisma.vehicle.findFirst({
      where: { tenantId, id: vehicleId, active: true },
      include: { routes: { where: { active: true }, select: { id: true } } }
    });
  },

  findRoute(tenantId: string, routeId: string) {
    return prisma.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
  },

  listRoutePrices(tenantId: string, routeId: string) {
    return prisma.routeProductPrice.findMany({
      where: { tenantId, routeId },
      include: {
        product: { include: { categoryRef: true } },
        route: { include: { vehicle: true } }
      },
      orderBy: [{ updatedAt: "desc" }, { product: { name: "asc" } }]
    });
  },

  listCategories(tenantId: string) {
    return prisma.productCategory.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } }
    });
  },

  createCategory(tenantId: string, input: CategoryInput) {
    return prisma.productCategory.create({ data: { ...input, tenantId } });
  },

  updateCategory(tenantId: string, categoryId: string, input: CategoryUpdateInput) {
    return prisma.productCategory.update({
      where: { id: categoryId },
      data: input
    });
  },

  async listProducts(tenantId: string, filters: ProductListFilters = {}) {
    const { page, pageSize, skip } = pagination(filters);
    const search = filters.search?.trim();
    const where = {
      tenantId,
      ...(filters.includeInactive ? {} : { active: true }),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
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
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
        include: {
          categoryRef: true,
          ...(filters.customerIdForPreferences
            ? { customerPreferences: { where: { customerId: filters.customerIdForPreferences }, select: { id: true } } }
            : {})
        },
        skip,
        take: pageSize
      }),
      prisma.product.count({ where })
    ]);
    return {
      products: products.map((product) => ({
        ...product,
        isPreferred: "customerPreferences" in product ? product.customerPreferences.length > 0 : false
      })),
      pagination: paginationMeta(total, page, pageSize)
    };
  },

  async setProductPreference(tenantId: string, customerId: string, productId: string, preferred: boolean) {
    if (!preferred) {
      await prisma.customerProductPreference.deleteMany({ where: { tenantId, customerId, productId } });
      return { tenantId, customerId, productId, preferred: false };
    }
    const preference = await prisma.customerProductPreference.upsert({
      where: { tenantId_productId_customerId: { tenantId, productId, customerId } },
      update: {},
      create: { tenantId, productId, customerId }
    });
    return { ...preference, preferred: true };
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
    }, { timeout: 15000 });
  },

  upsertRoutePrice(tenantId: string, input: RoutePriceInput) {
    return prisma.routeProductPrice.upsert({
      where: {
        tenantId_productId_routeId: {
          tenantId,
          productId: input.productId,
          routeId: input.routeId
        }
      },
      update: { price: input.price, notes: input.notes },
      create: { ...input, tenantId },
      include: {
        product: true,
        route: { include: { vehicle: true } }
      }
    });
  }
};
