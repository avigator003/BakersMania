import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { bakeryRoutesController } from "./routes.controller.js";
import { routeSchema, vehicleSchema } from "./routes.schemas.js";

export const bakeryRoutesRouter = Router({ mergeParams: true });

bakeryRoutesRouter.use(resolveTenant, requireAuth);

bakeryRoutesRouter.get("/vehicles", asyncHandler(bakeryRoutesController.listVehicles));
bakeryRoutesRouter.post("/vehicles", validateBody(vehicleSchema), asyncHandler(bakeryRoutesController.createVehicle));
bakeryRoutesRouter.patch("/vehicles/:vehicleId", validateBody(vehicleSchema), asyncHandler(bakeryRoutesController.updateVehicle));
bakeryRoutesRouter.get("/", asyncHandler(bakeryRoutesController.list));
bakeryRoutesRouter.post("/", validateBody(routeSchema), asyncHandler(bakeryRoutesController.create));
bakeryRoutesRouter.patch("/:routeId", validateBody(routeSchema), asyncHandler(bakeryRoutesController.update));
