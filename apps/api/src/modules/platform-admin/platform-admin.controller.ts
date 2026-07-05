import type { Request, Response } from "express";
import { platformAdminService } from "./platform-admin.service.js";

export const platformAdminController = {
  async listTenants(_req: Request, res: Response) {
    res.json({ tenants: await platformAdminService.listTenants() });
  },

  async listBilling(req: Request, res: Response) {
    const from = typeof req.query.from === "string" && req.query.from ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" && req.query.to ? new Date(req.query.to) : undefined;
    if (to) {
      to.setHours(23, 59, 59, 999);
    }

    const allowedBillingStatuses = ["PENDING", "PAID", "OVERDUE", "WAIVED"] as const;
    const billingStatusQuery = typeof req.query.billingStatus === "string" ? req.query.billingStatus : "";
    const billingStatus = allowedBillingStatuses.includes(billingStatusQuery as (typeof allowedBillingStatuses)[number])
      ? (billingStatusQuery as (typeof allowedBillingStatuses)[number])
      : undefined;
    res.json({ billing: await platformAdminService.listBilling({ from, to, billingStatus }) });
  },

  async onboardTenant(req: Request, res: Response) {
    res.status(201).json({ tenant: await platformAdminService.onboardTenant(req.body) });
  },

  async updateTenant(req: Request, res: Response) {
    res.json({ tenant: await platformAdminService.updateTenant(req.params.tenantId, req.body) });
  },

  async updateBilling(req: Request, res: Response) {
    res.json({ subscription: await platformAdminService.updateBilling(req.params.subscriptionId, req.body) });
  },

  async suspendTenant(req: Request, res: Response) {
    res.json({ tenant: await platformAdminService.suspendTenant(req.params.tenantId) });
  },

  async activateTenant(req: Request, res: Response) {
    res.json({ tenant: await platformAdminService.activateTenant(req.params.tenantId) });
  },

  async deleteTenant(req: Request, res: Response) {
    res.json({ tenant: await platformAdminService.deleteTenant(req.params.tenantId) });
  },

  async overview(_req: Request, res: Response) {
    res.json(await platformAdminService.getOverview());
  },

  async diagnostics(req: Request, res: Response) {
    const tenantSlug = typeof req.query.tenantSlug === "string" && req.query.tenantSlug.trim()
      ? req.query.tenantSlug.trim()
      : undefined;
    res.json(await platformAdminService.getDiagnostics(tenantSlug));
  },

  async requestMetrics(req: Request, res: Response) {
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    res.json(platformAdminService.getRequestMetrics(Number.isFinite(limit) ? limit : undefined));
  }
};
