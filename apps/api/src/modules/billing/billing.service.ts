import { billingRepository } from "./billing.repository.js";

export const billingService = {
  getSubscription(tenantId: string) {
    return billingRepository.findLatestSubscription(tenantId);
  },

  createCheckoutPlaceholder() {
    return {
      message: "Stripe Checkout integration placeholder",
      next: "Create Stripe customer/session here once STRIPE_SECRET_KEY is configured."
    };
  }
};
