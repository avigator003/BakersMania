import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { asyncHandler } from "../../utils/http.js";
import { reportsController } from "./reports.controller.js";

export const reportsRouter = Router({ mergeParams: true });

reportsRouter.use(resolveTenant, requireAuth);

reportsRouter.get("/dashboard", asyncHandler(reportsController.dashboard));
