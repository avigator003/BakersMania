import bcrypt from "bcryptjs";
import { HttpError } from "../../utils/http.js";
import { signAccessToken } from "../../utils/tokens.js";
import { authRepository } from "./auth.repository.js";
import type { CustomerSignupInput, LoginInput } from "./auth.schemas.js";

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function loginIdentifiers(identifier: string) {
  if (identifier.includes("@")) return [identifier.toLowerCase()];

  const normalized = normalizePhone(identifier);
  const digits = normalized.replace(/\D/g, "");
  const variants = new Set([normalized, digits]);

  if (digits.length === 10) {
    variants.add(`+91${digits}`);
    variants.add(`91${digits}`);
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    variants.add(`+${digits}`);
    variants.add(digits.slice(2));
  }

  return Array.from(variants).filter(Boolean);
}

function hasDesiredAccess(user: Awaited<ReturnType<typeof authRepository.findUsersWithAccess>>[number], actorType: LoginInput["desiredActor"]) {
  if (!actorType) return true;
  if (actorType === "bakery_user") return user.memberships.some((item) => item.active);
  if (actorType === "customer") return user.customers.length > 0;
  if (actorType === "vehicle") return user.vehicles.some((item) => item.active);
  return false;
}

export const authService = {
  async login(input: LoginInput) {
    const identifier = input.email.trim();
    const platformAdmin = await authRepository.findPlatformAdminByEmail(identifier);
    if (platformAdmin && (await bcrypt.compare(input.password, platformAdmin.passwordHash))) {
      return {
        token: signAccessToken({ sub: platformAdmin.id, actorType: "platform_admin" }),
        actorType: "platform_admin" as const
      };
    }

    const users = await authRepository.findUsersWithAccess(loginIdentifiers(identifier));
    const passwordMatches = [];
    for (const candidate of users) {
      if (await bcrypt.compare(input.password, candidate.passwordHash)) {
        passwordMatches.push(candidate);
      }
    }

    const user =
      passwordMatches.find((candidate) => hasDesiredAccess(candidate, input.desiredActor)) ||
      passwordMatches.find((candidate) => candidate.memberships.some((item) => item.active)) ||
      passwordMatches.find((candidate) => candidate.customers.length > 0) ||
      passwordMatches.find((candidate) => candidate.vehicles.some((item) => item.active)) ||
      null;

    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const activeMemberships = user.memberships.filter((item) => item.active);

    if (activeMemberships.length === 1) {
      const membership = activeMemberships[0];
      return {
        token: signAccessToken({
          sub: user.id,
          actorType: "bakery_user",
          tenantId: membership.tenantId,
          role: membership.role
        }),
        actorType: "bakery_user" as const,
        tenantSlug: membership.tenant.slug,
        tenantName: membership.tenant.name,
        role: membership.role
      };
    }

    if (activeMemberships.length > 1) {
      throw new HttpError(409, "Multiple bakery workspaces found. Workspace selection is required.");
    }

    const customerAccounts = user.customers;

    if (customerAccounts.length === 1) {
      const customer = customerAccounts[0];
      return {
        token: signAccessToken({
          sub: user.id,
          actorType: "customer",
          tenantId: customer.tenantId,
          customerId: customer.id
        }),
        actorType: "customer" as const,
        tenantSlug: customer.tenant.slug,
        tenantName: customer.tenant.name
      };
    }

    if (customerAccounts.length > 1) {
      throw new HttpError(409, "Multiple customer accounts found. Workspace selection is required.");
    }

    const vehicleAccounts = user.vehicles.filter((vehicle) => vehicle.active);

    if (vehicleAccounts.length === 1) {
      const vehicle = vehicleAccounts[0];
      return {
        token: signAccessToken({
          sub: user.id,
          actorType: "vehicle",
          tenantId: vehicle.tenantId,
          vehicleId: vehicle.id
        }),
        actorType: "vehicle" as const,
        tenantSlug: vehicle.tenant.slug,
        tenantName: vehicle.tenant.name
      };
    }

    if (vehicleAccounts.length > 1) {
      throw new HttpError(409, "Multiple vehicle workspaces found. Workspace selection is required.");
    }

    throw new HttpError(403, "No active bakery membership, customer account, or vehicle account found");
  },

  getSession(auth: NonNullable<Express.Request["auth"]>) {
    return { session: auth };
  },

  async signupCustomer(input: CustomerSignupInput) {
    const tenant = await authRepository.findTenantBySlug(input.tenantSlug);
    if (!tenant) {
      throw new HttpError(404, "Bakery not found");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await authRepository.upsertPortalUser({
      email: input.email,
      name: input.name,
      phone: input.phone,
      passwordHash
    });

    const customer = await authRepository.createCustomer({
      tenantId: tenant.id,
      userId: user.id,
      name: input.name,
      email: input.email,
      phone: input.phone
    });

    return {
      customer,
      token: signAccessToken({
        sub: user.id,
        actorType: "customer",
        tenantId: tenant.id,
        customerId: customer.id
      })
    };
  }
};
