import bcrypt from "bcryptjs";
import { performance } from "node:perf_hooks";
import { getRecentRequestMetrics } from "../../observability/request-metrics.js";
import { HttpError } from "../../utils/http.js";
import { platformAdminRepository } from "./platform-admin.repository.js";
import type { OnboardTenantInput, UpdateBillingInput, UpdateTenantInput } from "./platform-admin.schemas.js";

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

export const platformAdminService = {
  listTenants() {
    return platformAdminRepository.listTenants();
  },

  async onboardTenant(input: OnboardTenantInput) {
    const slug = input.slug || slugify(input.bakeryName);
    const exists = await platformAdminRepository.findTenantBySlug(slug);
    if (exists) {
      throw new HttpError(409, "Tenant slug already exists");
    }

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

  updateTenant(tenantId: string, input: UpdateTenantInput) {
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
