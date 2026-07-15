import { Prisma } from "@prisma/client";
import { catalogRepository } from "./catalog.repository.js";
import type { PriceHistoryFilters, ProductListFilters } from "./catalog.repository.js";
import type { CategoryInput, CategoryUpdateInput, CustomerPriceInput, ProductInput, ProductPreferenceInput, ProductUpdateInput, RoutePriceInput } from "./catalog.schemas.js";
import { HttpError } from "../../utils/http.js";
import type { AccessTokenPayload } from "../../utils/tokens.js";

function isProductNameUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && Array.isArray(error.meta?.target) && error.meta.target.includes("tenantId") && error.meta.target.includes("name");
}

export const catalogService = {
  listCategories(tenantId: string) {
    return catalogRepository.listCategories(tenantId);
  },

  createCategory(tenantId: string, input: CategoryInput) {
    return catalogRepository.createCategory(tenantId, input);
  },

  async updateCategory(tenantId: string, categoryId: string, input: CategoryUpdateInput) {
    const category = await catalogRepository.findCategory(tenantId, categoryId);
    if (!category) {
      throw new HttpError(404, "Category not found");
    }
    return catalogRepository.updateCategory(tenantId, categoryId, input);
  },

  async listProducts(tenantId: string, auth: AccessTokenPayload | undefined, filters: ProductListFilters = {}) {
    let customerIdForPreferences = filters.customerIdForPreferences;

    if (auth?.actorType === "customer") {
      customerIdForPreferences = auth.customerId;
    } else if (customerIdForPreferences) {
      if (auth?.actorType !== "bakery_user" && auth?.actorType !== "vehicle") {
        throw new HttpError(403, "Customer preference access required");
      }
      const customer = await catalogRepository.findCustomerForPreferenceAccess(tenantId, customerIdForPreferences);
      if (!customer) {
        throw new HttpError(404, "Customer not found");
      }
      if (auth.actorType === "vehicle") {
        const vehicle = await catalogRepository.findVehicleRoutes(tenantId, auth.vehicleId!);
        const allowedRouteIds = new Set(vehicle?.routes.map((route) => route.id) || []);
        if (!customer.routeId || !allowedRouteIds.has(customer.routeId)) {
          throw new HttpError(403, "Customer is not assigned to this vehicle");
        }
      }
    }

    return catalogRepository.listProducts(tenantId, { ...filters, customerIdForPreferences });
  },

  async getProduct(tenantId: string, productId: string) {
    const product = await catalogRepository.findProductDetail(tenantId, productId);
    if (!product) {
      throw new HttpError(404, "Product not found");
    }
    return product;
  },

  async setProductPreference(tenantId: string, auth: AccessTokenPayload | undefined, productId: string, input: ProductPreferenceInput) {
    if (auth?.actorType !== "customer" || !auth.customerId) {
      throw new HttpError(403, "Customer access required");
    }
    const product = await catalogRepository.findProduct(tenantId, productId);
    if (!product) {
      throw new HttpError(404, "Product not found");
    }
    return catalogRepository.setProductPreference(tenantId, auth.customerId, productId, input.preferred);
  },

  async listPriceHistory(tenantId: string, productId: string, filters: PriceHistoryFilters = {}) {
    const product = await catalogRepository.findProduct(tenantId, productId);
    if (!product) {
      throw new HttpError(404, "Product not found");
    }
    return catalogRepository.listPriceHistory(tenantId, productId, filters);
  },

  async listRoutePrices(tenantId: string, routeId: string) {
    const route = await catalogRepository.findRoute(tenantId, routeId);
    if (!route) {
      throw new HttpError(404, "Route not found");
    }
    return catalogRepository.listRoutePrices(tenantId, routeId);
  },

  async createProduct(tenantId: string, input: ProductInput) {
    if (input.categoryId) {
      const category = await catalogRepository.findCategory(tenantId, input.categoryId);
      if (!category) {
        throw new HttpError(400, "Selected category does not belong to this bakery");
      }
    }
    try {
      return await catalogRepository.createProduct(tenantId, input);
    } catch (error) {
      if (isProductNameUniqueError(error)) {
        throw new HttpError(409, "Product name already exists");
      }
      throw error;
    }
  },

  async updateProduct(tenantId: string, productId: string, input: ProductUpdateInput) {
    const product = await catalogRepository.findProduct(tenantId, productId);
    if (!product) {
      throw new HttpError(404, "Product not found");
    }
    if (input.categoryId) {
      const category = await catalogRepository.findCategory(tenantId, input.categoryId);
      if (!category) {
        throw new HttpError(400, "Selected category does not belong to this bakery");
      }
    }
    try {
      return await catalogRepository.updateProduct(tenantId, productId, input);
    } catch (error) {
      if (isProductNameUniqueError(error)) {
        throw new HttpError(409, "Product name already exists");
      }
      throw error;
    }
  },

  async upsertCustomerPrice(tenantId: string, input: CustomerPriceInput) {
    const [product, customer] = await Promise.all([
      catalogRepository.findProduct(tenantId, input.productId),
      catalogRepository.findCustomer(tenantId, input.customerId)
    ]);
    if (!product) {
      throw new HttpError(400, "Selected product does not belong to this bakery");
    }
    if (!customer) {
      throw new HttpError(400, "Selected customer does not belong to this bakery");
    }
    return catalogRepository.upsertCustomerPrice(tenantId, input);
  },

  async upsertRoutePrice(tenantId: string, input: RoutePriceInput) {
    const [product, route] = await Promise.all([
      catalogRepository.findProduct(tenantId, input.productId),
      catalogRepository.findRoute(tenantId, input.routeId)
    ]);
    if (!product) {
      throw new HttpError(400, "Selected product does not belong to this bakery");
    }
    if (!route) {
      throw new HttpError(400, "Selected route does not belong to this bakery");
    }
    return catalogRepository.upsertRoutePrice(tenantId, input);
  }
};
