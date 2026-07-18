import { z } from "zod";

export const routeSchema = z.object({
  name: z.string().min(2),
  vehicleId: z.string().optional(),
  active: z.boolean().default(true)
});

export const vehicleSchema = z.object({
  name: z.string().min(2),
  number: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().min(5),
  rcExpiryDate: z.coerce.date().optional(),
  rcPhotoUrl: z.string().optional(),
  pucExpiryDate: z.coerce.date().optional(),
  pucPhotoUrl: z.string().optional(),
  insuranceExpiryDate: z.coerce.date().optional(),
  insurancePhotoUrl: z.string().optional(),
  fitnessExpiryDate: z.coerce.date().optional(),
  fitnessPhotoUrl: z.string().optional(),
  active: z.boolean().default(true)
});

export const passwordUpdateSchema = z.object({
  password: z.string().min(6)
});

export type RouteInput = z.infer<typeof routeSchema>;
export type VehicleInput = z.infer<typeof vehicleSchema>;
export type PasswordUpdateInput = z.infer<typeof passwordUpdateSchema>;
