import { billingRepository } from "./billing.repository.js";

export const billingService = {
  getSubscription(tenantId: string) {
    return billingRepository.findLatestSubscription(tenantId);
  },

  createCheckoutPlaceholder() {
    return {
      message: "Manual billing is active",
      next: "Record subscription status and payments from the admin billing tools."
    };
  }
};
