import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(6)
});

export const customerSignupSchema = z.object({
  tenantSlug: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8)
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
