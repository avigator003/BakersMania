import type { RequestHandler } from "express";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../utils/http.js";

export const resolveTenant: RequestHandler = async (req, _res, next) => {
  try {
    const tenantSlug = req.params.tenantSlug || req.header("x-tenant-slug");
    const tenantId = req.auth?.tenantId || req.header("x-tenant-id");

    const tenant = tenantSlug
      ? await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
      : tenantId
        ? await prisma.tenant.findUnique({ where: { id: tenantId } })
        : null;

    if (!tenant) {
      next(new HttpError(404, "Tenant not found"));
      return;
    }

    if (tenant.status === "SUSPENDED") {
      next(new HttpError(403, "Tenant is suspended"));
      return;
    }

    if (req.auth?.tenantId && req.auth.tenantId !== tenant.id) {
      next(new HttpError(403, "Tenant access denied"));
      return;
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    next(error);
  }
};
