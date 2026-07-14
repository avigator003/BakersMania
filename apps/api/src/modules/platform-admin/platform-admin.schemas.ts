import { z } from "zod";

const orderPipelineStageSchema = z.object({
  key: z.enum(["CUSTOMER_SUBMITTED", "VEHICLE_REVIEW", "BAKERY_REVIEW"]),
  label: z.string().min(2),
  actorType: z.enum(["CUSTOMER", "VEHICLE", "BAKERY"]),
  order: z.coerce.number().int().positive(),
  enabled: z.boolean()
});

export const onboardTenantSchema = z.object({
  bakeryName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  postgresConnectionId: z.string().min(1).optional(),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  managerName: z.string().min(2).optional(),
  managerEmail: z.string().email().optional(),
  managerPhone: z.string().optional(),
  managerPassword: z.string().min(6).optional(),
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
  status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "SUSPENDED"]),
  postgresConnectionId: z.string().min(1).nullable().optional()
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

export const bakeryLeadSchema = z.object({
  phone: z.string().min(5),
  ownerName: z.string().min(2),
  bakeryName: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2),
  said: z.string().min(2),
  status: z.enum(["REJECTED", "PENDING", "IN_PROCESS", "ACCEPTED"]).default("PENDING"),
  nextCallAt: z.coerce.date()
});

export const updateBakeryLeadSchema = bakeryLeadSchema.partial();

export const postgresConnectionSchema = z.object({
  name: z.string().min(2),
  databaseUrl: z.string().url().refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
    message: "Database URL must be a PostgreSQL connection URL"
  })
});

export const updateOrderPipelineSchema = z.object({
  enabled: z.boolean().default(true),
  stages: z.array(orderPipelineStageSchema).min(1)
});

export type OnboardTenantInput = z.infer<typeof onboardTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type UpdateBillingInput = z.infer<typeof updateBillingSchema>;
export type BakeryLeadInput = z.infer<typeof bakeryLeadSchema>;
export type UpdateBakeryLeadInput = z.infer<typeof updateBakeryLeadSchema>;
export type PostgresConnectionInput = z.infer<typeof postgresConnectionSchema>;
export type UpdateOrderPipelineInput = z.infer<typeof updateOrderPipelineSchema>;
