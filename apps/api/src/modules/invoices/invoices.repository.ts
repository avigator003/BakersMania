import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export const invoicesRepository = {
  findOrderWithInvoice(tenantId: string, orderId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: { invoice: true }
    });
  },

  countInvoices(tenantId: string) {
    return prisma.invoice.count({ where: { tenantId } });
  },

  createInvoice(input: {
    tenantId: string;
    orderId: string;
    invoiceNumber: string;
    total: Prisma.Decimal | number | string;
    paymentStatus: "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
  }) {
    return prisma.invoice.create({ data: input });
  },

  listInvoices(tenantId: string) {
    return prisma.invoice.findMany({
      where: { tenantId },
      include: { order: { include: { customer: true } } },
      orderBy: { createdAt: "desc" }
    });
  }
};
