import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { asyncHandler } from "../../utils/http.js";
import { billingController } from "./billing.controller.js";

export const billingRouter = Router({ mergeParams: true });

billingRouter.use(resolveTenant, requireAuth);

billingRouter.get("/subscription", asyncHandler(billingController.subscription));
billingRouter.post("/checkout", asyncHandler(billingController.checkout));
