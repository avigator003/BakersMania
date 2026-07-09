import { OrderSource, OrderStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive()
});

export const createOrderSchema = z.object({
  customerId: z.string().optional(),
  source: z.nativeEnum(OrderSource),
  fulfillmentType: z.enum(["PICKUP", "DELIVERY"]).default("PICKUP"),
  dueAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1)
});

export const updateOrderSchema = createOrderSchema;

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  paymentAmount: z.coerce.number().positive().optional(),
  paymentMethod: z.string().min(1).optional().default("Cash"),
  reference: z.string().optional()
});

export const repeatOrdersSchema = z.object({
  sourceDate: z.string().min(10),
  targetDate: z.string().min(10),
  routeId: z.string().optional()
});

export const routeInvoicePaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.string().min(1).default("Cash"),
  reference: z.string().optional()
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type RepeatOrdersInput = z.infer<typeof repeatOrdersSchema>;
export type RouteInvoicePaymentInput = z.infer<typeof routeInvoicePaymentSchema>;
