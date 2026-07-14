import { OrderSource, OrderStatus, PaymentStatus, VehicleOrderStatus } from "@prisma/client";
import { z } from "zod";

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive()
});

const orderItemsSchema = z.preprocess(
  (items) => Array.isArray(items)
    ? items.filter((item) => Number((item as { quantity?: unknown }).quantity || 0) > 0)
    : items,
  z.array(orderItemSchema).min(1)
);

export const createOrderSchema = z.object({
  customerId: z.string().optional(),
  source: z.nativeEnum(OrderSource),
  fulfillmentType: z.enum(["PICKUP", "DELIVERY"]).default("PICKUP"),
  dueAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  items: orderItemsSchema
});

export const updateOrderSchema = createOrderSchema;

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  vehicleStatus: z.nativeEnum(VehicleOrderStatus).optional(),
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

export const routeInvoiceLockSchema = z.object({
  date: z.string().min(10),
  locked: z.boolean()
});

export const customerPaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  mode: z.enum(["PARTIAL", "ORDER_FULL", "DUE_FULL"]),
  orderId: z.string().optional(),
  date: z.string().min(10).optional(),
  method: z.string().min(1).default("Cash"),
  reference: z.string().optional()
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type RepeatOrdersInput = z.infer<typeof repeatOrdersSchema>;
export type RouteInvoicePaymentInput = z.infer<typeof routeInvoicePaymentSchema>;
export type RouteInvoiceLockInput = z.infer<typeof routeInvoiceLockSchema>;
export type CustomerPaymentInput = z.infer<typeof customerPaymentSchema>;
