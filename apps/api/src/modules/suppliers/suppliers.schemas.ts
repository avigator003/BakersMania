import { z } from "zod";

export const supplierSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional()
});

export const purchaseSchema = z.object({
  supplierId: z.string().min(1),
  itemId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  amount: z.coerce.number().positive().optional(),
  paidAmount: z.coerce.number().nonnegative().default(0),
  paymentType: z.enum(["ADVANCE", "PARTIAL", "FULL"]).optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  purchasedAt: z.coerce.date().optional()
});

export const purchasePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  paymentType: z.enum(["ADVANCE", "PARTIAL", "FULL"]).default("PARTIAL"),
  method: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
  paidAt: z.coerce.date().optional()
});

export type SupplierInput = z.infer<typeof supplierSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type PurchasePaymentInput = z.infer<typeof purchasePaymentSchema>;
