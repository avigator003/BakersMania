import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { staffController } from "./staff.controller.js";
import { attendanceSchema, labourSchema, labourUpdateSchema, salaryPaymentSchema } from "./staff.schemas.js";

export const staffRouter = Router({ mergeParams: true });

staffRouter.use(resolveTenant, requireAuth);

staffRouter.get("/labour", asyncHandler(staffController.listLabourDashboard));
staffRouter.post("/labour", validateBody(labourSchema), asyncHandler(staffController.createLabour));
staffRouter.get("/labour/export/year", asyncHandler(staffController.exportLabourYear));
staffRouter.patch("/labour/:labourId", validateBody(labourUpdateSchema), asyncHandler(staffController.updateLabour));
staffRouter.get("/labour/:labourId", asyncHandler(staffController.getLabourDetail));
staffRouter.post("/attendance", validateBody(attendanceSchema), asyncHandler(staffController.createAttendance));
staffRouter.post("/salary-payments", validateBody(salaryPaymentSchema), asyncHandler(staffController.createSalaryPayment));
