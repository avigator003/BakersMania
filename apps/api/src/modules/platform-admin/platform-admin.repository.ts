import { BakeryRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export const platformAdminRepository = {
  listPostgresConnections() {
    return prisma.postgresConnection.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, status: true }
        }
      }
    });
  },

  findPostgresConnection(connectionId: string) {
    return prisma.postgresConnection.findUnique({
      where: { id: connectionId },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, status: true }
        }
      }
    });
  },

  createPostgresConnection(input: { name: string; databaseUrl: string }) {
    return prisma.postgresConnection.create({ data: input });
  },

  listBakeryLeads(filters: {
    status?: "REJECTED" | "PENDING" | "IN_PROCESS" | "ACCEPTED";
    nextCallFrom?: Date;
    nextCallTo?: Date;
  }) {
    return prisma.bakeryLead.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.nextCallFrom || filters.nextCallTo
          ? {
              nextCallAt: {
                ...(filters.nextCallFrom ? { gte: filters.nextCallFrom } : {}),
                ...(filters.nextCallTo ? { lt: filters.nextCallTo } : {})
              }
            }
          : {})
      },
      orderBy: [{ nextCallAt: "asc" }, { updatedAt: "desc" }]
    });
  },

  createBakeryLead(input: {
    phone: string;
    ownerName: string;
    bakeryName: string;
    city: string;
    state: string;
    said: string;
    status: "REJECTED" | "PENDING" | "IN_PROCESS" | "ACCEPTED";
    nextCallAt: Date;
  }) {
    return prisma.bakeryLead.create({ data: input });
  },

  updateBakeryLead(
    leadId: string,
    input: {
      phone?: string;
      ownerName?: string;
      bakeryName?: string;
      city?: string;
      state?: string;
      said?: string;
      status?: "REJECTED" | "PENDING" | "IN_PROCESS" | "ACCEPTED";
      nextCallAt?: Date;
    }
  ) {
    return prisma.bakeryLead.update({
      where: { id: leadId },
      data: input
    });
  },

  deleteBakeryLead(leadId: string) {
    return prisma.bakeryLead.delete({ where: { id: leadId } });
  },

  listTenants() {
    return prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
        postgresConnection: true
      }
    });
  },

  findTenantBySlug(slug: string) {
    return prisma.tenant.findUnique({ where: { slug } });
  },

  findTenantById(tenantId: string) {
    return prisma.tenant.findUnique({ where: { id: tenantId }, include: { postgresConnection: true } });
  },

  updateTenantOrderPipeline(tenantId: string, input: { enabled: boolean; stages: Prisma.InputJsonValue }) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        orderPipelineEnabled: input.enabled,
        orderPipelineStages: input.stages
      }
    });
  },

  createTenant(input: {
    bakeryName: string;
    slug: string;
    ownerName: string;
    ownerEmail: string;
    ownerPasswordHash: string;
    managerName?: string;
    managerEmail?: string;
    managerPhone?: string;
    managerPasswordHash?: string;
    phone?: string;
    address?: string;
    postgresConnectionId?: string;
    planCode: string;
    monthlyAmount: number;
    recurrence: "MONTHLY" | "EVERY_2_MONTHS" | "QUARTERLY" | "YEARLY" | "CUSTOM";
    recurrenceMonths: number;
    lastPaymentDate?: Date;
    nextDueDate?: Date;
    lastPaymentAmount?: number;
    billingStatus: "PENDING" | "PAID" | "OVERDUE" | "WAIVED";
  }) {
    return prisma.tenant.create({
      data: {
        name: input.bakeryName,
        slug: input.slug,
        ownerEmail: input.ownerEmail,
        phone: input.phone,
        address: input.address,
        postgresConnectionId: input.postgresConnectionId,
        users: {
          create: [
            {
              role: BakeryRole.OWNER,
              user: {
                connectOrCreate: {
                  where: { email: input.ownerEmail },
                  create: {
                    email: input.ownerEmail,
                    name: input.ownerName,
                    passwordHash: input.ownerPasswordHash,
                    phone: input.phone
                  }
                }
              }
            },
            ...(input.managerName && input.managerEmail && input.managerPasswordHash
              ? [
                  {
                    role: BakeryRole.MANAGER,
                    user: {
                      connectOrCreate: {
                        where: { email: input.managerEmail },
                        create: {
                          email: input.managerEmail,
                          name: input.managerName,
                          passwordHash: input.managerPasswordHash,
                          phone: input.managerPhone
                        }
                      }
                    }
                  }
                ]
              : [])
          ]
        },
        subscriptions: {
          create: {
            status: "TRIALING",
            planCode: input.planCode,
            monthlyAmount: input.monthlyAmount,
            recurrence: input.recurrence,
            recurrenceMonths: input.recurrenceMonths,
            lastPaymentDate: input.lastPaymentDate,
            nextDueDate: input.nextDueDate,
            lastPaymentAmount: input.lastPaymentAmount,
            billingStatus: input.billingStatus
          }
        }
      },
      include: { users: { include: { user: true } }, subscriptions: true }
    });
  },

  listBilling(filters: { from?: Date; to?: Date; billingStatus?: "PENDING" | "PAID" | "OVERDUE" | "WAIVED" }) {
    const nextDueDate: Prisma.DateTimeNullableFilter | undefined =
      filters.from || filters.to
        ? {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {})
          }
        : undefined;

    return prisma.subscription.findMany({
      where: {
        ...(filters.billingStatus ? { billingStatus: filters.billingStatus } : {}),
        ...(nextDueDate ? { nextDueDate } : {})
      },
      include: { tenant: true },
      orderBy: [{ nextDueDate: "asc" }, { createdAt: "desc" }]
    });
  },

  updateBilling(
    subscriptionId: string,
    input: {
      status?: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "SUSPENDED";
      billingStatus?: "PENDING" | "PAID" | "OVERDUE" | "WAIVED";
      planCode?: string;
      monthlyAmount?: number;
      recurrence?: "MONTHLY" | "EVERY_2_MONTHS" | "QUARTERLY" | "YEARLY" | "CUSTOM";
      recurrenceMonths?: number;
      lastPaymentDate?: Date | null;
      lastPaymentPeriodFrom?: Date | null;
      lastPaymentPeriodTo?: Date | null;
      nextDueDate?: Date | null;
      lastPaymentAmount?: number | null;
    }
  ) {
    return prisma.subscription.update({
      where: { id: subscriptionId },
      data: input,
      include: { tenant: true }
    });
  },

  updateTenant(
    tenantId: string,
    input: {
      bakeryName: string;
      ownerEmail: string;
      phone?: string;
      address?: string;
      status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "SUSPENDED";
      postgresConnectionId?: string | null;
    }
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: input.bakeryName,
        ownerEmail: input.ownerEmail,
        phone: input.phone,
        address: input.address,
        status: input.status,
        ...(input.postgresConnectionId !== undefined ? { postgresConnectionId: input.postgresConnectionId } : {})
      }
    });
  },

  suspendTenant(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "SUSPENDED" }
    });
  },

  activateTenant(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE" }
    });
  },

  async deleteTenant(tenantId: string) {
    return prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { tenantId },
        select: { id: true }
      });
      const orderIds = orders.map((order) => order.id);

      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.invoice.deleteMany({ where: { tenantId } });
      if (orderIds.length) {
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      }
      await tx.order.deleteMany({ where: { tenantId } });
      await tx.purchase.deleteMany({ where: { tenantId } });
      await tx.supplier.deleteMany({ where: { tenantId } });
      await tx.inventoryItem.deleteMany({ where: { tenantId } });
      await tx.expense.deleteMany({ where: { tenantId } });
      await tx.attendance.deleteMany({ where: { tenantId } });
      await tx.salaryPayment.deleteMany({ where: { tenantId } });
      await tx.labour.deleteMany({ where: { tenantId } });
      await tx.customerProductPrice.deleteMany({ where: { tenantId } });
      await tx.customer.deleteMany({ where: { tenantId } });
      await tx.product.deleteMany({ where: { tenantId } });
      await tx.productCategory.deleteMany({ where: { tenantId } });
      await tx.route.deleteMany({ where: { tenantId } });
      await tx.vehicle.deleteMany({ where: { tenantId } });
      await tx.subscription.deleteMany({ where: { tenantId } });
      await tx.auditLog.deleteMany({ where: { tenantId } });
      await tx.membership.deleteMany({ where: { tenantId } });
      return tx.tenant.delete({ where: { id: tenantId } });
    });
  },

  getOverviewCounts() {
    return Promise.all([prisma.tenant.count(), prisma.order.count(), prisma.customer.count()]);
  },

  dbPing() {
    return prisma.$queryRaw<Array<{ ok: number }>>`select 1 as ok`;
  },

  findTenantForDiagnostics(slug: string) {
    return prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, status: true }
    });
  },

  getTenantDiagnosticsCounts(tenantId: string) {
    return Promise.all([
      prisma.customer.count({ where: { tenantId } }),
      prisma.order.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.route.count({ where: { tenantId } }),
      prisma.vehicle.count({ where: { tenantId } }),
      prisma.expense.count({ where: { tenantId } })
    ]);
  }
};
