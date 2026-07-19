import { prisma } from "../../db/prisma.js";
import { pagination, paginationMeta, type PaginationInput } from "../../utils/pagination.js";
import type { AssignCustomerPricesInput, CategoryInput, CategoryUpdateInput, CustomerPriceInput, ProductInput, ProductUpdateInput, RoutePriceInput } from "./catalog.schemas.js";

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
    return prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true, routeId: true } });
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

  listActiveRouteIds(tenantId: string) {
    return prisma.route.findMany({ where: { tenantId, active: true }, select: { id: true } });
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

  async assignCustomerPricesFromRouteBase(tenantId: string, routeIds: string[], input: AssignCustomerPricesInput) {
    const customers = await prisma.customer.findMany({
      where: { tenantId, routeId: { in: routeIds } },
      select: { id: true, routeId: true }
    });
    const overrideProductIds = input.prices?.map((price) => price.productId).filter(Boolean);
    const products = await prisma.product.findMany({
      where: {
        tenantId,
        active: true,
        ...(overrideProductIds?.length ? { id: { in: overrideProductIds } } : {})
      },
      select: { id: true, unitPrice: true }
    });
    const routePrices = await prisma.routeProductPrice.findMany({
      where: { tenantId, routeId: { in: routeIds } },
      select: { routeId: true, productId: true, price: true }
    });

    if (!customers.length || !products.length) {
      return { customers: customers.length, products: products.length, created: 0, updated: 0, skipped: 0 };
    }

    const productIds = products.map((product) => product.id);
    const customerIds = customers.map((customer) => customer.id);
    const existingPrices = await prisma.customerProductPrice.findMany({
      where: { tenantId, customerId: { in: customerIds }, productId: { in: productIds } },
      select: { customerId: true, productId: true, price: true }
    });
    const existingMap = new Map(existingPrices.map((price) => [`${price.customerId}:${price.productId}`, price]));
    const routePriceMap = new Map(routePrices.map((price) => [`${price.routeId}:${price.productId}`, Number(price.price || 0)]));
    const basePriceMap = new Map(products.map((product) => [product.id, Number(product.unitPrice || 0)]));
    const overridePriceMap = new Map((input.prices || []).map((price) => [price.productId, Number(price.price || 0)]));
    const assignments = customers.flatMap((customer) => products.map((product) => {
      const price = overridePriceMap.get(product.id) ?? routePriceMap.get(`${customer.routeId}:${product.id}`) ?? basePriceMap.get(product.id) ?? 0;
      const existing = existingMap.get(`${customer.id}:${product.id}`);
      return { customerId: customer.id, productId: product.id, price, existing };
    }));
    const writableAssignments = assignments.filter((assignment) => input.overwriteExisting || !assignment.existing);

    let created = 0;
    let updated = 0;
    const batchSize = 150;
    for (let index = 0; index < writableAssignments.length; index += batchSize) {
      const batch = writableAssignments.slice(index, index + batchSize);
      const result = await prisma.$transaction(async (tx) => {
        let batchCreated = 0;
        let batchUpdated = 0;
        for (const assignment of batch) {
          const existing = assignment.existing;
          await tx.customerProductPrice.upsert({
            where: {
              tenantId_productId_customerId: {
                tenantId,
                productId: assignment.productId,
                customerId: assignment.customerId
              }
            },
            update: { price: assignment.price, notes: "Assigned from vehicle route base price" },
            create: {
              tenantId,
              productId: assignment.productId,
              customerId: assignment.customerId,
              price: assignment.price,
              notes: "Assigned from vehicle route base price"
            }
          });

          if (!existing) {
            batchCreated += 1;
          } else if (Number(existing.price) !== assignment.price) {
            batchUpdated += 1;
          }
          if (!existing || Number(existing.price) !== assignment.price) {
            await tx.customerProductPriceHistory.create({
              data: {
                tenantId,
                productId: assignment.productId,
                customerId: assignment.customerId,
                oldPrice: existing?.price,
                newPrice: assignment.price
              }
            });
          }
        }
        return { created: batchCreated, updated: batchUpdated };
      }, { timeout: 15000 });
      created += result.created;
      updated += result.updated;
    }

    return {
      customers: customers.length,
      products: products.length,
      created,
      updated,
      skipped: assignments.length - writableAssignments.length
    };
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
