import { Router } from "express";
import { asyncHandler } from "../../utils/http.js";
import { tenantsController } from "./tenants.controller.js";

export const tenantsRouter = Router();

tenantsRouter.get("/:tenantSlug/public", asyncHandler(tenantsController.publicTenant));
