import type { Request, Response } from "express";
import { tenantsService } from "./tenants.service.js";

export const tenantsController = {
  async publicTenant(req: Request, res: Response) {
    res.json({ tenant: await tenantsService.getPublicTenant(req.params.tenantSlug) });
  }
};
