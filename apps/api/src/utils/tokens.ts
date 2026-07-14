import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  actorType: "platform_admin" | "bakery_user" | "customer" | "vehicle";
  tenantId?: string;
  tenantSlug?: string;
  postgresConnectionId?: string | null;
  role?: string;
  customerId?: string;
  vehicleId?: string;
};

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "8h" });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}
