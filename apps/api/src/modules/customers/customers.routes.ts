import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { customersController } from "./customers.controller.js";
import { customerSchema, customerUpdateSchema, passwordUpdateSchema } from "./customers.schemas.js";

export const customersRouter = Router({ mergeParams: true });

customersRouter.use(resolveTenant, requireAuth);

customersRouter.get("/", asyncHandler(customersController.list));
customersRouter.post("/", validateBody(customerSchema), asyncHandler(customersController.create));
customersRouter.get("/me", asyncHandler(customersController.me));
customersRouter.patch("/me", validateBody(customerUpdateSchema), asyncHandler(customersController.updateMe));
customersRouter.patch("/me/password", validateBody(passwordUpdateSchema), asyncHandler(customersController.updateMyPassword));
customersRouter.get("/:customerId/ledger", asyncHandler(customersController.ledger));
customersRouter.patch("/:customerId/password", validateBody(passwordUpdateSchema), asyncHandler(customersController.resetPassword));
customersRouter.patch("/:customerId", validateBody(customerUpdateSchema), asyncHandler(customersController.update));
