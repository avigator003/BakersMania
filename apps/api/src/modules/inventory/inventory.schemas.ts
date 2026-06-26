import { z } from "zod";

export const inventoryItemSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2).default("General"),
  description: z.string().optional(),
  unit: z.string().min(1),
  stockOnHand: z.coerce.number().default(0),
  reorderAt: z.coerce.number().default(0),
  unitPrice: z.coerce.number().optional()
});

export const inventoryLedgerSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(["BUY", "USE"]),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().optional(),
  note: z.string().optional(),
  happenedAt: z.coerce.date().optional()
});

export const productStockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  mode: z.enum(["ADD", "SET"]).default("ADD")
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type InventoryLedgerInput = z.infer<typeof inventoryLedgerSchema>;
export type ProductStockAdjustmentInput = z.infer<typeof productStockAdjustmentSchema>;
