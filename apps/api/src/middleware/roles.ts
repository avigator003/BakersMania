import type { RequestHandler } from "express";
import { BakeryRole } from "@prisma/client";
import { HttpError } from "../utils/http.js";

export const requireBakeryRole = (...roles: BakeryRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (req.auth?.actorType !== "bakery_user" || !req.auth.role) {
      next(new HttpError(403, "Bakery staff access required"));
      return;
    }

    if (!roles.includes(req.auth.role as BakeryRole)) {
      next(new HttpError(403, "Role does not have permission"));
      return;
    }

    next();
  };
};

export const requireCustomer: RequestHandler = (req, _res, next) => {
  if (req.auth?.actorType !== "customer" || !req.auth.customerId) {
    next(new HttpError(403, "Customer portal access required"));
    return;
  }
  next();
};
