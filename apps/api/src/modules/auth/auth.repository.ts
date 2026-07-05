import { prisma } from "../../db/prisma.js";

export const authRepository = {
  findPlatformAdminByEmail(email: string) {
    return prisma.platformAdmin.findUnique({ where: { email } });
  },

  findUsersWithAccess(identifiers: string[]) {
    return prisma.user.findMany({
      where: { OR: identifiers.map((identifier) => (identifier.includes("@") ? { email: identifier } : { phone: identifier })) },
      include: {
        memberships: { include: { tenant: true } },
        customers: { include: { tenant: true } },
        vehicles: { include: { tenant: true } }
      }
    });
  },

  findTenantBySlug(slug: string) {
    return prisma.tenant.findUnique({ where: { slug } });
  },

  findCustomerForUserTenant(userId: string, tenantId: string) {
    return prisma.customer.findFirst({
      where: { userId, tenantId }
    });
  },

  upsertPortalUser(input: { email: string; name: string; phone?: string; passwordHash: string }) {
    return prisma.user.upsert({
      where: { email: input.email },
      update: { name: input.name, phone: input.phone, passwordHash: input.passwordHash },
      create: input
    });
  },

  createCustomer(input: {
    tenantId: string;
    userId: string;
    name: string;
    email: string;
    phone?: string;
  }) {
    return prisma.customer.create({ data: input });
  }
};
