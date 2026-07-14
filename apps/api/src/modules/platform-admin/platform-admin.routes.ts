import { Router } from "express";
import { requireAuth, requirePlatformAdmin } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { platformAdminController } from "./platform-admin.controller.js";
import {
  bakeryLeadSchema,
  onboardTenantSchema,
  postgresConnectionSchema,
  updatePostgresConnectionSchema,
  updateBakeryLeadSchema,
  updateBillingSchema,
  updateOrderPipelineSchema,
  updateTenantSchema
} from "./platform-admin.schemas.js";

export const platformAdminRouter = Router();

platformAdminRouter.use(requireAuth, requirePlatformAdmin);

platformAdminRouter.get("/postgres-connections", asyncHandler(platformAdminController.listPostgresConnections));
platformAdminRouter.post("/postgres-connections", validateBody(postgresConnectionSchema), asyncHandler(platformAdminController.createPostgresConnection));
platformAdminRouter.patch("/postgres-connections/:connectionId", validateBody(updatePostgresConnectionSchema), asyncHandler(platformAdminController.updatePostgresConnection));
platformAdminRouter.delete("/postgres-connections/:connectionId", asyncHandler(platformAdminController.deletePostgresConnection));
platformAdminRouter.get("/leads", asyncHandler(platformAdminController.listBakeryLeads));
platformAdminRouter.post("/leads", validateBody(bakeryLeadSchema), asyncHandler(platformAdminController.createBakeryLead));
platformAdminRouter.patch("/leads/:leadId", validateBody(updateBakeryLeadSchema), asyncHandler(platformAdminController.updateBakeryLead));
platformAdminRouter.delete("/leads/:leadId", asyncHandler(platformAdminController.deleteBakeryLead));
platformAdminRouter.get("/tenants", asyncHandler(platformAdminController.listTenants));
platformAdminRouter.get("/tenants/:tenantId/order-pipeline", asyncHandler(platformAdminController.getOrderPipeline));
platformAdminRouter.patch("/tenants/:tenantId/order-pipeline", validateBody(updateOrderPipelineSchema), asyncHandler(platformAdminController.updateOrderPipeline));
platformAdminRouter.get("/billing", asyncHandler(platformAdminController.listBilling));
platformAdminRouter.post("/tenants", validateBody(onboardTenantSchema), asyncHandler(platformAdminController.onboardTenant));
platformAdminRouter.patch("/tenants/:tenantId", validateBody(updateTenantSchema), asyncHandler(platformAdminController.updateTenant));
platformAdminRouter.patch("/billing/:subscriptionId", validateBody(updateBillingSchema), asyncHandler(platformAdminController.updateBilling));
platformAdminRouter.patch("/tenants/:tenantId/suspend", asyncHandler(platformAdminController.suspendTenant));
platformAdminRouter.patch("/tenants/:tenantId/activate", asyncHandler(platformAdminController.activateTenant));
platformAdminRouter.delete("/tenants/:tenantId", asyncHandler(platformAdminController.deleteTenant));
platformAdminRouter.get("/reports/overview", asyncHandler(platformAdminController.overview));
platformAdminRouter.get("/diagnostics", asyncHandler(platformAdminController.diagnostics));
platformAdminRouter.get("/request-metrics", asyncHandler(platformAdminController.requestMetrics));
