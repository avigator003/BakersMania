import { inventoryRepository } from "./inventory.repository.js";
import type { InventoryItemFilters, ProductStockFilters } from "./inventory.repository.js";
import { HttpError } from "../../utils/http.js";
import type { InventoryItemInput, InventoryLedgerInput, ProductStockAdjustmentInput } from "./inventory.schemas.js";

export const inventoryService = {
  listItems(tenantId: string, filters: InventoryItemFilters = {}) {
    return inventoryRepository.listItems(tenantId, filters);
  },

  createItem(tenantId: string, input: InventoryItemInput) {
    return inventoryRepository.createItem(tenantId, input);
  },

  async listItemLedger(tenantId: string, itemId: string) {
    const item = await inventoryRepository.findItem(tenantId, itemId);
    if (!item) {
      throw new HttpError(404, "Raw material not found");
    }
    return inventoryRepository.listItemLedger(tenantId, itemId);
  },

  async adjustItem(tenantId: string, input: InventoryLedgerInput) {
    const item = await inventoryRepository.findItem(tenantId, input.itemId);
    if (!item) {
      throw new HttpError(404, "Raw material not found");
    }
    if (input.type === "USE" && Number(item.stockOnHand) < input.quantity) {
      throw new HttpError(400, "Not enough raw material stock available");
    }
    return inventoryRepository.adjustItem(tenantId, input);
  },

  listProductStock(tenantId: string, filters: ProductStockFilters) {
    return inventoryRepository.listProductStock(tenantId, filters);
  },

  async adjustProductStock(tenantId: string, input: ProductStockAdjustmentInput) {
    const product = await inventoryRepository.findProduct(tenantId, input.productId);
    if (!product) {
      throw new HttpError(404, "Product not found");
    }
    return inventoryRepository.adjustProductStock(tenantId, input);
  }
};
