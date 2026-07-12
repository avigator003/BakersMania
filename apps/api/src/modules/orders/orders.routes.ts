import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/http.js";
import { ordersController } from "./orders.controller.js";
import { createOrderSchema, customerPaymentSchema, repeatOrdersSchema, routeInvoicePaymentSchema, updateOrderSchema, updateOrderStatusSchema } from "./orders.schemas.js";

export const ordersRouter = Router({ mergeParams: true });

ordersRouter.use(resolveTenant);

ordersRouter.get("/", requireAuth, asyncHandler(ordersController.list));
ordersRouter.get("/truck-loading", requireAuth, asyncHandler(ordersController.truckLoading));
ordersRouter.get("/route-statement", requireAuth, asyncHandler(ordersController.routeStatement));
ordersRouter.get("/route-invoices", requireAuth, asyncHandler(ordersController.routeInvoices));
ordersRouter.get("/customer-day-summary", requireAuth, asyncHandler(ordersController.customerDaySummary));
ordersRouter.post("/", requireAuth, validateBody(createOrderSchema), asyncHandler(ordersController.create));
ordersRouter.post("/repeat", requireAuth, validateBody(repeatOrdersSchema), asyncHandler(ordersController.repeat));
ordersRouter.post("/customers/:customerId/payments", requireAuth, validateBody(customerPaymentSchema), asyncHandler(ordersController.recordCustomerPayment));
ordersRouter.post("/route-invoices/:routeId/payments", requireAuth, validateBody(routeInvoicePaymentSchema), asyncHandler(ordersController.recordRouteInvoicePayment));
ordersRouter.patch("/:orderId/status", requireAuth, validateBody(updateOrderStatusSchema), asyncHandler(ordersController.updateStatus));
ordersRouter.patch("/:orderId", requireAuth, validateBody(updateOrderSchema), asyncHandler(ordersController.update));
