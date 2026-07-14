import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { optionalAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { billingRouter } from "./modules/billing/billing.routes.js";
import { catalogRouter } from "./modules/catalog/catalog.routes.js";
import { customersRouter } from "./modules/customers/customers.routes.js";
import { financeRouter } from "./modules/finance/finance.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { invoicesRouter } from "./modules/invoices/invoices.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { platformAdminRouter } from "./modules/platform-admin/platform-admin.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { bakeryRoutesRouter } from "./modules/routes/routes.routes.js";
import { staffRouter } from "./modules/staff/staff.routes.js";
import { suppliersRouter } from "./modules/suppliers/suppliers.routes.js";
import { tenantsRouter } from "./modules/tenants/tenants.routes.js";
import { requestMetricsMiddleware } from "./observability/request-metrics.js";

const allowedOrigins = env.WEB_URL.split(",").map((origin) => origin.trim()).filter(Boolean);

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    maxAge: 86400
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestContext);
  app.use(requestMetricsMiddleware);
  app.use(morgan("tiny"));
  app.use(optionalAuth);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "bakersmania-api" });
  });

  app.use("/auth", authRouter);
  app.use("/platform-admin", platformAdminRouter);
  app.use("/tenants", tenantsRouter);
  app.use("/t/:tenantSlug/customers", customersRouter);
  app.use("/t/:tenantSlug/catalog", catalogRouter);
  app.use("/t/:tenantSlug/orders", ordersRouter);
  app.use("/t/:tenantSlug/invoices", invoicesRouter);
  app.use("/t/:tenantSlug/inventory", inventoryRouter);
  app.use("/t/:tenantSlug/suppliers", suppliersRouter);
  app.use("/t/:tenantSlug/finance", financeRouter);
  app.use("/t/:tenantSlug/staff", staffRouter);
  app.use("/t/:tenantSlug/routes", bakeryRoutesRouter);
  app.use("/t/:tenantSlug/billing", billingRouter);
  app.use("/t/:tenantSlug/reports", reportsRouter);

  app.use(errorHandler);

  return app;
}
