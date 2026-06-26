import { HttpError } from "../../utils/http.js";
import { suppliersRepository } from "./suppliers.repository.js";
import type { PurchaseInput, PurchasePaymentInput, SupplierInput } from "./suppliers.schemas.js";

export const suppliersService = {
  list(tenantId: string) {
    return suppliersRepository.list(tenantId);
  },

  create(tenantId: string, input: SupplierInput) {
    return suppliersRepository.create(tenantId, input);
  },

  listPurchases(tenantId: string, filters: { month?: string; status?: string; supplierId?: string }) {
    return suppliersRepository.listPurchases(tenantId, filters);
  },

  async createPurchase(tenantId: string, input: PurchaseInput) {
    const [supplier, item] = await Promise.all([
      suppliersRepository.findSupplier(tenantId, input.supplierId),
      suppliersRepository.findItem(tenantId, input.itemId)
    ]);
    if (!supplier) throw new HttpError(404, "Seller not found");
    if (!item) throw new HttpError(404, "Raw material not found");
    return suppliersRepository.createPurchase(tenantId, input);
  },

  async addPayment(tenantId: string, purchaseId: string, input: PurchasePaymentInput) {
    const purchase = await suppliersRepository.findPurchase(tenantId, purchaseId);
    if (!purchase) throw new HttpError(404, "Purchase not found");
    const remaining = Number(purchase.amount) - Number(purchase.paidAmount);
    if (input.amount > remaining) {
      throw new HttpError(400, "Payment amount is more than remaining due");
    }
    return suppliersRepository.addPayment(tenantId, purchaseId, input);
  }
};
