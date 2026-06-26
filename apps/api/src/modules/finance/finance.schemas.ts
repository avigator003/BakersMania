import { z } from "zod";

export const expenseSchema = z.object({
  type: z.enum(["RENT", "MISCELLANEOUS"]).default("MISCELLANEOUS"),
  category: z.string().min(2),
  routeId: z.string().optional(),
  status: z.enum(["PENDING", "PAID", "CANCELED"]).default("PENDING"),
  recurring: z.coerce.boolean().default(false),
  amount: z.coerce.number().positive(),
  notes: z.string().optional(),
  spentAt: z.coerce.date().optional()
});

export const expenseStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "CANCELED"])
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseStatusInput = z.infer<typeof expenseStatusSchema>;
