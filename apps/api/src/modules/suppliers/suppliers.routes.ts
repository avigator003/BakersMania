import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { suppliersController } from "./suppliers.controller.js";
import { purchasePaymentSchema, purchaseSchema, supplierSchema } from "./suppliers.schemas.js";

export const suppliersRouter = Router({ mergeParams: true });

suppliersRouter.use(resolveTenant, requireAuth);

suppliersRouter.get("/", asyncHandler(suppliersController.list));
suppliersRouter.post("/", validateBody(supplierSchema), asyncHandler(suppliersController.create));
suppliersRouter.get("/purchases", asyncHandler(suppliersController.listPurchases));
suppliersRouter.post("/purchases", validateBody(purchaseSchema), asyncHandler(suppliersController.createPurchase));
suppliersRouter.post("/purchases/:purchaseId/payments", validateBody(purchasePaymentSchema), asyncHandler(suppliersController.addPayment));
