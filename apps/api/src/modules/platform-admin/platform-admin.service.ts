import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { platformPrisma } from "../../db/prisma.js";
import { getTenantPrismaClient } from "../../db/tenant-prisma-registry.js";
import { getRecentRequestMetrics } from "../../observability/request-metrics.js";
import { HttpError } from "../../utils/http.js";
import { defaultOrderPipelineStages } from "../orders/order-pipeline.js";
import { platformAdminRepository } from "./platform-admin.repository.js";
import type {
  BakeryLeadInput,
  OnboardTenantInput,
  PostgresConnectionInput,
  UpdateBakeryLeadInput,
  UpdateBillingInput,
  UpdateOrderPipelineInput,
  UpdatePostgresConnectionInput,
  UpdateTenantInput
} from "./platform-admin.schemas.js";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function dateRangeForDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new HttpError(422, "Invalid date filter");
  }
  const from = new Date(Date.UTC(year, month - 1, day));
  const to = new Date(Date.UTC(year, month - 1, day + 1));
  return { from, to };
}

function recurrenceMonths(recurrence: OnboardTenantInput["recurrence"], customMonths: number) {
  if (recurrence === "EVERY_2_MONTHS") return 2;
  if (recurrence === "QUARTERLY") return 3;
  if (recurrence === "YEARLY") return 12;
  if (recurrence === "CUSTOM") return customMonths;
  return 1;
}

async function measure<T>(label: string, run: () => Promise<T>) {
  const start = performance.now();
  try {
    const value = await run();
    return { label, ok: true, durationMs: Math.round(performance.now() - start), value };
  } catch (error) {
    return {
      label,
      ok: false,
      durationMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

async function ensurePostgresConnectionAvailable(connectionId?: string | null, tenantId?: string) {
  if (!connectionId) return;
  const connection = await platformAdminRepository.findPostgresConnection(connectionId);
  if (!connection) {
    throw new HttpError(404, "Postgres connection not found");
  }
  if (connection.tenant && connection.tenant.id !== tenantId) {
    throw new HttpError(409, "Postgres connection is already attached to another bakery");
  }
}

export const platformAdminService = {
  listPostgresConnections() {
    return platformAdminRepository.listPostgresConnections();
  },

  createPostgresConnection(input: PostgresConnectionInput) {
    return platformAdminRepository.createPostgresConnection(input);
  },

  async updatePostgresConnection(connectionId: string, input: UpdatePostgresConnectionInput) {
    const connection = await platformAdminRepository.findPostgresConnection(connectionId);
    if (!connection) {
      throw new HttpError(404, "Postgres connection not found");
    }
    return platformAdminRepository.updatePostgresConnection(connectionId, input);
  },

  async deletePostgresConnection(connectionId: string) {
    const connection = await platformAdminRepository.findPostgresConnection(connectionId);
    if (!connection) {
      throw new HttpError(404, "Postgres connection not found");
    }
    if (connection.tenant) {
      throw new HttpError(409, "Detach this DB from the bakery before deleting it");
    }
    return platformAdminRepository.deletePostgresConnection(connectionId);
  },

  listBakeryLeads(filters: { view?: string; date?: string; status?: string }) {
    const allowedStatuses = ["REJECTED", "PENDING", "IN_PROCESS", "ACCEPTED"] as const;
    const status = allowedStatuses.includes(filters.status as (typeof allowedStatuses)[number])
      ? (filters.status as (typeof allowedStatuses)[number])
      : undefined;
    const day = filters.view === "today" ? filters.date || new Date().toISOString().slice(0, 10) : filters.date;
    const range = day ? dateRangeForDay(day) : undefined;
    return platformAdminRepository.listBakeryLeads({
      status,
      nextCallFrom: range?.from,
      nextCallTo: range?.to
    });
  },

  createBakeryLead(input: BakeryLeadInput) {
    return platformAdminRepository.createBakeryLead(input);
  },

  updateBakeryLead(leadId: string, input: UpdateBakeryLeadInput) {
    return platformAdminRepository.updateBakeryLead(leadId, input);
  },

  deleteBakeryLead(leadId: string) {
    return platformAdminRepository.deleteBakeryLead(leadId);
  },

  listTenants() {
    return platformAdminRepository.listTenants();
  },

  async getOrderPipeline(tenantId: string) {
    const tenant = await platformAdminRepository.findTenantById(tenantId);
    if (!tenant) {
      throw new HttpError(404, "Tenant not found");
    }
    return {
      enabled: tenant.orderPipelineEnabled,
      stages: tenant.orderPipelineStages || defaultOrderPipelineStages
    };
  },

  async updateOrderPipeline(tenantId: string, input: UpdateOrderPipelineInput) {
    const tenant = await platformAdminRepository.findTenantById(tenantId);
    if (!tenant) {
      throw new HttpError(404, "Tenant not found");
    }
    const stages = input.stages as unknown as Prisma.InputJsonValue;
    const updated = await platformAdminRepository.updateTenantOrderPipeline(tenantId, {
      enabled: input.enabled,
      stages
    });

    if (tenant.postgresConnectionId) {
      const tenantPrisma = await getTenantPrismaClient({
        platformPrisma,
        postgresConnectionId: tenant.postgresConnectionId
      });
      await tenantPrisma.tenant.update({
        where: { id: tenantId },
        data: {
          orderPipelineEnabled: input.enabled,
          orderPipelineStages: stages
        }
      });
    }

    return updated;
  },

  async onboardTenant(input: OnboardTenantInput) {
    const slug = input.slug || slugify(input.bakeryName);
    const exists = await platformAdminRepository.findTenantBySlug(slug);
    if (exists) {
      throw new HttpError(409, "Tenant slug already exists");
    }
    await ensurePostgresConnectionAvailable(input.postgresConnectionId);

    const ownerPasswordHash = await bcrypt.hash(input.ownerPassword, 12);
    const managerPasswordHash = input.managerPassword ? await bcrypt.hash(input.managerPassword, 12) : undefined;
    const months = recurrenceMonths(input.recurrence, input.recurrenceMonths);
    const lastPaymentDate = input.lastPaymentDate;
    if ((input.managerName || input.managerEmail || input.managerPhone || input.managerPassword) && (!input.managerName || !input.managerEmail || !input.managerPassword)) {
      throw new HttpError(422, "Manager name, email, and password are required to create a bakery manager");
    }
    return platformAdminRepository.createTenant({
      ...input,
      slug,
      ownerPasswordHash,
      managerPasswordHash,
      recurrenceMonths: months,
      nextDueDate: input.nextDueDate || (lastPaymentDate ? addMonths(lastPaymentDate, months) : undefined)
    });
  },

  listBilling(filters: { from?: Date; to?: Date; billingStatus?: "PENDING" | "PAID" | "OVERDUE" | "WAIVED" }) {
    return platformAdminRepository.listBilling(filters);
  },

  updateBilling(subscriptionId: string, input: UpdateBillingInput) {
    return platformAdminRepository.updateBilling(subscriptionId, input);
  },

  async updateTenant(tenantId: string, input: UpdateTenantInput) {
    await ensurePostgresConnectionAvailable(input.postgresConnectionId, tenantId);
    return platformAdminRepository.updateTenant(tenantId, input);
  },

  suspendTenant(tenantId: string) {
    return platformAdminRepository.suspendTenant(tenantId);
  },

  activateTenant(tenantId: string) {
    return platformAdminRepository.activateTenant(tenantId);
  },

  deleteTenant(tenantId: string) {
    return platformAdminRepository.deleteTenant(tenantId);
  },

  async getOverview() {
    const [tenantCount, orderCount, customerCount] = await platformAdminRepository.getOverviewCounts();
    return { tenantCount, orderCount, customerCount };
  },

  async getDiagnostics(tenantSlug?: string) {
    const startedAt = new Date();
    const uptimeSeconds = Math.round(process.uptime());
    const dbPing = await measure("db ping: select 1", () => platformAdminRepository.dbPing());
    const platformCounts = await measure("platform counts", async () => {
      const [tenantCount, orderCount, customerCount] = await platformAdminRepository.getOverviewCounts();
      return { tenantCount, orderCount, customerCount };
    });

    let tenant:
      | {
          lookup: Awaited<ReturnType<typeof measure>>;
          counts?: Awaited<ReturnType<typeof measure>>;
        }
      | null = null;

    if (tenantSlug) {
      const lookup = await measure("tenant lookup", () => platformAdminRepository.findTenantForDiagnostics(tenantSlug));
      tenant = { lookup };
      if (lookup.ok && lookup.value) {
        const tenantId = lookup.value.id;
        tenant.counts = await measure("tenant row counts", async () => {
          const [customerCount, orderCount, productCount, routeCount, vehicleCount, expenseCount] =
            await platformAdminRepository.getTenantDiagnosticsCounts(tenantId);
          return { customerCount, orderCount, productCount, routeCount, vehicleCount, expenseCount };
        });
      }
    }

    return {
      generatedAt: startedAt.toISOString(),
      nodeEnv: process.env.NODE_ENV || "unknown",
      uptimeSeconds,
      tenantSlug: tenantSlug || null,
      checks: {
        dbPing,
        platformCounts,
        tenant
      }
    };
  },

  getRequestMetrics(limit?: number) {
    return { metrics: getRecentRequestMetrics(limit) };
  }
};
