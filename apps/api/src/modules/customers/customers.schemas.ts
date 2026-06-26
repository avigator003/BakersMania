import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  aadhaarPhotoUrl: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  creditLimit: z.coerce.number().nonnegative().optional(),
  routeId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional()
});

export const customerUpdateSchema = customerSchema.partial();

export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
