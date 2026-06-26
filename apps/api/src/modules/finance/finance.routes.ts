import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { financeController } from "./finance.controller.js";
import { expenseSchema, expenseStatusSchema } from "./finance.schemas.js";

export const financeRouter = Router({ mergeParams: true });

financeRouter.use(resolveTenant, requireAuth);

financeRouter.get("/expenses", asyncHandler(financeController.listExpenses));
financeRouter.post("/expenses", validateBody(expenseSchema), asyncHandler(financeController.createExpense));
financeRouter.patch("/expenses/:expenseId/status", validateBody(expenseStatusSchema), asyncHandler(financeController.updateExpenseStatus));
