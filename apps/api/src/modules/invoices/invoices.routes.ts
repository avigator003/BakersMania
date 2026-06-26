import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { asyncHandler } from "../../utils/http.js";
import { invoicesController } from "./invoices.controller.js";

export const invoicesRouter = Router({ mergeParams: true });

invoicesRouter.use(resolveTenant, requireAuth);

invoicesRouter.post("/from-order/:orderId", asyncHandler(invoicesController.createFromOrder));
invoicesRouter.get("/", asyncHandler(invoicesController.list));
