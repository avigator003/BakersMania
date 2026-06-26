import type { RequestHandler } from "express";
import { HttpError } from "../utils/http.js";
import { verifyAccessToken } from "../utils/tokens.js";

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.access_token;

  if (!token) {
    next();
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(new HttpError(401, "Authentication required"));
    return;
  }
  next();
};

export const requirePlatformAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.actorType !== "platform_admin") {
    next(new HttpError(403, "Platform admin access required"));
    return;
  }
  next();
};
