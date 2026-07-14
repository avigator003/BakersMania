import { z } from "zod";
export const loginSchema = z
  .object({
    email: z.string().min(3).optional(),
    identifier: z.string().min(3).optional(),
    password: z.string().min(6),
    desiredActor: z.enum(["platform_admin", "bakery_user", "customer", "vehicle"]).optional()
  })
  .refine((value) => value.email || value.identifier, {
    path: ["email"],
    message: "Required"
  })
  .transform((value) => ({
    email: value.email || value.identifier || "",
    password: value.password,
    desiredActor: value.desiredActor
  }));

export const customerSignupSchema = z.object({
  tenantSlug: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8)
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
