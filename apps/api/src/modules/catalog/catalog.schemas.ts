import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  active: z.boolean().default(true)
});

export const productSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  unitPrice: z.coerce.number().nonnegative(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  active: z.boolean().default(true)
});

export const productUpdateSchema = productSchema.partial();

export const customerPriceSchema = z.object({
  productId: z.string().min(1),
  customerId: z.string().min(1),
  price: z.coerce.number().nonnegative(),
  notes: z.string().optional()
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type CustomerPriceInput = z.infer<typeof customerPriceSchema>;
