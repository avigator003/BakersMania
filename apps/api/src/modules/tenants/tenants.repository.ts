import { prisma } from "../../db/prisma.js";

export const tenantsRepository = {
  findPublicBySlug(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, status: true, currency: true, taxLabel: true }
    });
  }
};
