import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { catalogController } from "./catalog.controller.js";
import { categorySchema, categoryUpdateSchema, customerPriceSchema, productSchema, productUpdateSchema, routePriceSchema } from "./catalog.schemas.js";

export const catalogRouter = Router({ mergeParams: true });

catalogRouter.use(resolveTenant);

catalogRouter.get("/categories", requireAuth, asyncHandler(catalogController.listCategories));
catalogRouter.post("/categories", requireAuth, validateBody(categorySchema), asyncHandler(catalogController.createCategory));
catalogRouter.patch("/categories/:categoryId", requireAuth, validateBody(categoryUpdateSchema), asyncHandler(catalogController.updateCategory));
catalogRouter.get("/products", asyncHandler(catalogController.listProducts));
catalogRouter.post("/products", requireAuth, validateBody(productSchema), asyncHandler(catalogController.createProduct));
catalogRouter.get("/products/:productId", requireAuth, asyncHandler(catalogController.getProduct));
catalogRouter.get("/products/:productId/price-history", requireAuth, asyncHandler(catalogController.listPriceHistory));
catalogRouter.patch("/products/:productId", requireAuth, validateBody(productUpdateSchema), asyncHandler(catalogController.updateProduct));
catalogRouter.post("/customer-prices", requireAuth, validateBody(customerPriceSchema), asyncHandler(catalogController.upsertCustomerPrice));
catalogRouter.get("/route-prices", requireAuth, asyncHandler(catalogController.listRoutePrices));
catalogRouter.post("/route-prices", requireAuth, validateBody(routePriceSchema), asyncHandler(catalogController.upsertRoutePrice));
