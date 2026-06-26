import bcrypt from "bcryptjs";
import { HttpError } from "../../utils/http.js";
import { signAccessToken } from "../../utils/tokens.js";
import { authRepository } from "./auth.repository.js";
import type { CustomerSignupInput, LoginInput } from "./auth.schemas.js";

export const authService = {
  async login(input: LoginInput) {
    const platformAdmin = await authRepository.findPlatformAdminByEmail(input.email);
    if (platformAdmin && (await bcrypt.compare(input.password, platformAdmin.passwordHash))) {
      return {
        token: signAccessToken({ sub: platformAdmin.id, actorType: "platform_admin" }),
        actorType: "platform_admin" as const
      };
    }

    const user = await authRepository.findUserWithAccess(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
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

    throw new HttpError(403, "No active bakery membership or customer account found");
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
