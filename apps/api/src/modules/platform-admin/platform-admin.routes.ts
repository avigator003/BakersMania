import { Router } from "express";
import { requireAuth, requirePlatformAdmin } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { platformAdminController } from "./platform-admin.controller.js";
import { onboardTenantSchema, updateBillingSchema, updateTenantSchema } from "./platform-admin.schemas.js";

export const platformAdminRouter = Router();

platformAdminRouter.use(requireAuth, requirePlatformAdmin);

platformAdminRouter.get("/tenants", asyncHandler(platformAdminController.listTenants));
platformAdminRouter.get("/billing", asyncHandler(platformAdminController.listBilling));
platformAdminRouter.post("/tenants", validateBody(onboardTenantSchema), asyncHandler(platformAdminController.onboardTenant));
platformAdminRouter.patch("/tenants/:tenantId", validateBody(updateTenantSchema), asyncHandler(platformAdminController.updateTenant));
platformAdminRouter.patch("/billing/:subscriptionId", validateBody(updateBillingSchema), asyncHandler(platformAdminController.updateBilling));
platformAdminRouter.patch("/tenants/:tenantId/suspend", asyncHandler(platformAdminController.suspendTenant));
platformAdminRouter.patch("/tenants/:tenantId/activate", asyncHandler(platformAdminController.activateTenant));
platformAdminRouter.delete("/tenants/:tenantId", asyncHandler(platformAdminController.deleteTenant));
platformAdminRouter.get("/reports/overview", asyncHandler(platformAdminController.overview));
