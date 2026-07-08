import { catalogRepository } from "./catalog.repository.js";
import type { PriceHistoryFilters, ProductListFilters } from "./catalog.repository.js";
import type { CategoryInput, CategoryUpdateInput, CustomerPriceInput, ProductInput, ProductUpdateInput, RoutePriceInput } from "./catalog.schemas.js";
import { HttpError } from "../../utils/http.js";

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

  listProducts(tenantId: string, filters: ProductListFilters = {}) {
    return catalogRepository.listProducts(tenantId, filters);
  },

  async getProduct(tenantId: string, productId: string) {
    const product = await catalogRepository.findProductDetail(tenantId, productId);
    if (!product) {
      throw new HttpError(404, "Product not found");
    }
    return product;
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
    return catalogRepository.createProduct(tenantId, input);
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
    return catalogRepository.updateProduct(tenantId, productId, input);
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
