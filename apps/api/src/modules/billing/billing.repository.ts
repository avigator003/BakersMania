import { prisma } from "../../db/prisma.js";

export const billingRepository = {
  findLatestSubscription(tenantId: string) {
    return prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" }
    });
  }
};
