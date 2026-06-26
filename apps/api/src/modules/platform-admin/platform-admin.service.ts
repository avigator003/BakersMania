import bcrypt from "bcryptjs";
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
    const months = recurrenceMonths(input.recurrence, input.recurrenceMonths);
    const lastPaymentDate = input.lastPaymentDate;
    return platformAdminRepository.createTenant({
      ...input,
      slug,
      ownerPasswordHash,
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
  }
};
