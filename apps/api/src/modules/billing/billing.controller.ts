import type { Request, Response } from "express";
import { billingService } from "./billing.service.js";

export const billingController = {
  async subscription(req: Request, res: Response) {
    res.json({ subscription: await billingService.getSubscription(req.tenant!.id) });
  },

  async checkout(_req: Request, res: Response) {
    res.status(202).json(billingService.createCheckoutPlaceholder());
  }
};
