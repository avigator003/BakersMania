import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { inventoryController } from "./inventory.controller.js";
import { inventoryItemSchema, inventoryLedgerSchema, productStockAdjustmentSchema } from "./inventory.schemas.js";

export const inventoryRouter = Router({ mergeParams: true });

inventoryRouter.use(resolveTenant, requireAuth);

inventoryRouter.get("/items", asyncHandler(inventoryController.listItems));
inventoryRouter.post("/items", validateBody(inventoryItemSchema), asyncHandler(inventoryController.createItem));
inventoryRouter.get("/items/:itemId/ledger", asyncHandler(inventoryController.listItemLedger));
inventoryRouter.post("/items/adjust", validateBody(inventoryLedgerSchema), asyncHandler(inventoryController.adjustItem));
inventoryRouter.get("/product-stock", asyncHandler(inventoryController.productStock));
inventoryRouter.post("/product-stock/adjust", validateBody(productStockAdjustmentSchema), asyncHandler(inventoryController.adjustProductStock));
