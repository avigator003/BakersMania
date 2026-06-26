import { z } from "zod";

export const onboardTenantSchema = z.object({
  bakeryName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  phone: z.string().optional(),
  address: z.string().optional(),
  planCode: z.string().min(2).default("starter"),
  monthlyAmount: z.coerce.number().nonnegative().default(0),
  recurrence: z.enum(["MONTHLY", "EVERY_2_MONTHS", "QUARTERLY", "YEARLY", "CUSTOM"]).default("MONTHLY"),
  recurrenceMonths: z.coerce.number().int().positive().default(1),
  lastPaymentDate: z.coerce.date().optional(),
  nextDueDate: z.coerce.date().optional(),
  lastPaymentAmount: z.coerce.number().nonnegative().optional(),
  billingStatus: z.enum(["PENDING", "PAID", "OVERDUE", "WAIVED"]).default("PENDING")
});

export const updateTenantSchema = z.object({
  bakeryName: z.string().min(2),
  ownerEmail: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "SUSPENDED"])
});

export const updateBillingSchema = z.object({
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "SUSPENDED"]).optional(),
  billingStatus: z.enum(["PENDING", "PAID", "OVERDUE", "WAIVED"]).optional(),
  planCode: z.string().min(2).optional(),
  monthlyAmount: z.coerce.number().nonnegative().optional(),
  recurrence: z.enum(["MONTHLY", "EVERY_2_MONTHS", "QUARTERLY", "YEARLY", "CUSTOM"]).optional(),
  recurrenceMonths: z.coerce.number().int().positive().optional(),
  lastPaymentDate: z.coerce.date().nullable().optional(),
  lastPaymentPeriodFrom: z.coerce.date().nullable().optional(),
  lastPaymentPeriodTo: z.coerce.date().nullable().optional(),
  nextDueDate: z.coerce.date().nullable().optional(),
  lastPaymentAmount: z.coerce.number().nonnegative().nullable().optional()
});

export type OnboardTenantInput = z.infer<typeof onboardTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type UpdateBillingInput = z.infer<typeof updateBillingSchema>;
