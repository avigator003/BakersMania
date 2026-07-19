import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { authController } from "./auth.controller.js";
import { customerSignupSchema, loginSchema, passwordUpdateSchema } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/login", validateBody(loginSchema), asyncHandler(authController.login));
authRouter.post("/customers/signup", validateBody(customerSignupSchema), asyncHandler(authController.signupCustomer));
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
authRouter.patch("/me/password", requireAuth, validateBody(passwordUpdateSchema), asyncHandler(authController.updateMyPassword));
