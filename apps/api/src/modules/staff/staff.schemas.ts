import { z } from "zod";

export const labourSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "MANAGER", "ACCOUNTANT", "LABOURER", "DELIVERY_STAFF", "CASHIER"]).default("LABOURER"),
  skill: z.string().optional(),
  dailyWage: z.coerce.number().nonnegative().optional(),
  monthlySalary: z.coerce.number().nonnegative().optional(),
  joinedAt: z.coerce.date().optional(),
  notes: z.string().optional()
});

export const labourUpdateSchema = z.object({
  active: z.boolean().optional()
});

export const attendanceSchema = z.object({
  userId: z.string().optional().default(""),
  labourId: z.string().min(1),
  workDate: z.coerce.date(),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "PAID_LEAVE", "UNPAID_LEAVE"]),
  notes: z.string().optional()
});

export const salaryPaymentSchema = z.object({
  userId: z.string().optional().default(""),
  labourId: z.string().min(1),
  amount: z.coerce.number().positive(),
  period: z.string().min(2),
  paymentType: z.enum(["ADVANCE", "PARTIAL", "FULL"]),
  reason: z.string().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
  paidAt: z.coerce.date().optional(),
  notes: z.string().optional()
});

export type LabourInput = z.infer<typeof labourSchema>;
export type LabourUpdateInput = z.infer<typeof labourUpdateSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type SalaryPaymentInput = z.infer<typeof salaryPaymentSchema>;
