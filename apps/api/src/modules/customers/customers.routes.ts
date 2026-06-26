import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { customersController } from "./customers.controller.js";
import { customerSchema, customerUpdateSchema } from "./customers.schemas.js";

export const customersRouter = Router({ mergeParams: true });

customersRouter.use(resolveTenant, requireAuth);

customersRouter.get("/", asyncHandler(customersController.list));
customersRouter.post("/", validateBody(customerSchema), asyncHandler(customersController.create));
customersRouter.get("/:customerId/ledger", asyncHandler(customersController.ledger));
customersRouter.patch("/:customerId", validateBody(customerUpdateSchema), asyncHandler(customersController.update));
