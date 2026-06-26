import type { AccessTokenPayload } from "../../utils/tokens.js";
import { HttpError } from "../../utils/http.js";
import { ordersRepository } from "./orders.repository.js";
import type { CreateOrderInput, RepeatOrdersInput, UpdateOrderStatusInput } from "./orders.schemas.js";

type OrderFilters = {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  routeId?: string;
};

async function buildOrderPayload(tenantId: string, customerId: string, input: CreateOrderInput) {
  const customer = await ordersRepository.findCustomer(tenantId, customerId);
  if (!customer) {
    throw new HttpError(404, "Customer not found");
  }

  const products = await ordersRepository.findProducts(
    tenantId,
    input.items.map((item) => item.productId),
    customerId
  );

  if (products.length !== input.items.length) {
    throw new HttpError(422, "One or more products are unavailable");
  }

  const orderItems = input.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)!;
    const pricedProduct = product as typeof product & { customerPrices?: Array<{ price: unknown }> };
    const unitPrice = Number(pricedProduct.customerPrices?.[0]?.price || product.unitPrice);
    const taxRate = Number(product.taxRate);
    const lineSubtotal = unitPrice * item.quantity;
    const lineTax = lineSubtotal * (taxRate / 100);

    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice,
      taxRate,
      lineTotal: lineSubtotal + lineTax
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxTotal = orderItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity * (item.taxRate / 100),
    0
  );
  const { items: _items, customerId: _customerId, ...orderInput } = input;

  return {
    customer,
    orderInput,
    items: orderItems,
    totals: {
      subtotal,
      taxTotal,
      discountTotal: 0,
      grandTotal: subtotal + taxTotal
    }
  };
}

export const ordersService = {
  listOrders(tenantId: string, auth: AccessTokenPayload | undefined, filters: OrderFilters = {}) {
    if (auth?.actorType === "customer") {
      return ordersRepository.listForCustomer(tenantId, auth.customerId!);
    }

    return ordersRepository.listForStaff(tenantId, filters);
  },

  async createOrder(tenantId: string, auth: AccessTokenPayload | undefined, input: CreateOrderInput) {
    if (auth?.actorType === "customer" && input.source !== "CUSTOMER_PORTAL") {
      throw new HttpError(403, "Customers can only create customer portal orders");
    }

    const resolvedCustomerId = auth?.actorType === "customer" ? auth.customerId : input.customerId;
    if (!resolvedCustomerId) {
      throw new HttpError(422, "customerId is required for staff-created orders");
    }

    const payload = await buildOrderPayload(tenantId, resolvedCustomerId, input);

    return ordersRepository.createOrder({
      tenantId,
      customerId: resolvedCustomerId,
      routeId: payload.customer.routeId,
      orderInput: payload.orderInput,
      totals: payload.totals,
      items: payload.items
    });
  },

  async updateOrder(tenantId: string, auth: AccessTokenPayload | undefined, orderId: string, input: CreateOrderInput) {
    if (auth?.actorType === "customer") {
      throw new HttpError(403, "Customers cannot update orders");
    }

    const existing = await ordersRepository.findOrder(tenantId, orderId);
    if (!existing) {
      throw new HttpError(404, "Order not found");
    }

    const resolvedCustomerId = input.customerId || existing.customerId;
    const payload = await buildOrderPayload(tenantId, resolvedCustomerId, input);
    const paid = existing.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const paymentStatus = paid >= payload.totals.grandTotal && payload.totals.grandTotal > 0
      ? "PAID"
      : paid > 0
        ? "PARTIAL"
        : "UNPAID";

    return ordersRepository.updateOrder({
      tenantId,
      orderId,
      customerId: resolvedCustomerId,
      routeId: payload.customer.routeId,
      orderInput: payload.orderInput,
      totals: payload.totals,
      items: payload.items,
      paymentStatus
    });
  },

  async updateOrderStatus(
    tenantId: string,
    auth: AccessTokenPayload | undefined,
    orderId: string,
    input: UpdateOrderStatusInput
  ) {
    if (auth?.actorType === "customer") {
      throw new HttpError(403, "Customers cannot update order status");
    }

    const existing = await ordersRepository.findOrder(tenantId, orderId);
    if (!existing) {
      throw new HttpError(404, "Order not found");
    }

    const paid = existing.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const due = Math.max(Number(existing.grandTotal || 0) - paid, 0);
    let payment: { amount: number; method: string; reference?: string } | undefined;

    if (input.paymentStatus === "PARTIAL") {
      if (!input.paymentAmount) {
        throw new HttpError(422, "Partial payment amount is required");
      }
      if (input.paymentAmount > due) {
        throw new HttpError(422, "Partial payment amount cannot be greater than due amount");
      }
      payment = { amount: input.paymentAmount, method: input.paymentMethod || "Cash", reference: input.reference };
    }

    if (input.paymentStatus === "PAID" && due > 0) {
      payment = { amount: due, method: input.paymentMethod || "Cash", reference: input.reference };
    }

    if (input.paymentStatus === "UNPAID" && paid > 0) {
      throw new HttpError(422, "Cannot mark unpaid because payments already exist");
    }

    return ordersRepository.updateOrderStatus({
      tenantId,
      orderId,
      status: input.status,
      paymentStatus: input.paymentStatus,
      payment
    });
  },

  async repeatOrders(tenantId: string, auth: AccessTokenPayload | undefined, input: RepeatOrdersInput) {
    if (auth?.actorType === "customer") {
      throw new HttpError(403, "Customers cannot repeat staff orders");
    }
    const sourceOrders = await ordersRepository.listForDate(tenantId, {
      date: input.sourceDate,
      routeId: input.routeId
    });
    const created = [];
    for (const order of sourceOrders) {
      const copiedInput: CreateOrderInput = {
        customerId: order.customerId,
        source: "STAFF_CREATED",
        fulfillmentType: order.fulfillmentType,
        dueAt: new Date(`${input.targetDate}T00:00:00.000Z`),
        notes: `Repeated from ${input.sourceDate}`,
        items: order.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }))
      };
      const payload = await buildOrderPayload(tenantId, order.customerId, copiedInput);
      created.push(await ordersRepository.createOrder({
        tenantId,
        customerId: order.customerId,
        routeId: payload.customer.routeId,
        orderInput: payload.orderInput,
        totals: payload.totals,
        items: payload.items
      }));
    }
    return { sourceDate: input.sourceDate, targetDate: input.targetDate, copied: created.length, orders: created };
  },

  async routeStatement(tenantId: string, filters: { startDate: string; endDate: string; routeId?: string }) {
    const orders = await ordersRepository.listForRange(tenantId, filters);
    const customers = new Map<string, { customerId: string; customerName: string; routeName: string; orderTotal: number; paidTotal: number; dueTotal: number; orderCount: number }>();
    orders.forEach((order) => {
      const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const total = Number(order.grandTotal || 0);
      const existing = customers.get(order.customerId) || {
        customerId: order.customerId,
        customerName: order.customer.name,
        routeName: order.route?.name || order.customer.route?.name || "No route",
        orderTotal: 0,
        paidTotal: 0,
        dueTotal: 0,
        orderCount: 0
      };
      existing.orderTotal += total;
      existing.paidTotal += paid;
      existing.dueTotal += Math.max(total - paid, 0);
      existing.orderCount += 1;
      customers.set(order.customerId, existing);
    });
    const rows = Array.from(customers.values()).sort((a, b) => a.routeName.localeCompare(b.routeName) || a.customerName.localeCompare(b.customerName));
    return {
      ...filters,
      totals: {
        customers: rows.length,
        orders: orders.length,
        orderTotal: rows.reduce((sum, row) => sum + row.orderTotal, 0),
        paidTotal: rows.reduce((sum, row) => sum + row.paidTotal, 0),
        dueTotal: rows.reduce((sum, row) => sum + row.dueTotal, 0)
      },
      rows
    };
  },

  async truckLoading(tenantId: string, filters: { date: string; categoryId?: string }) {
    const orders = await ordersRepository.truckLoading(tenantId, filters);
    const productMap = new Map<string, { id: string; name: string; category: string }>();
    const routeMap = new Map<string, { id: string; name: string; quantities: Record<string, number>; total: number }>();

    orders.forEach((order) => {
      const route = order.route || order.customer.route;
      const routeId = route?.id || "no-route";
      const routeName = route?.name || "No route";
      if (!routeMap.has(routeId)) {
        routeMap.set(routeId, { id: routeId, name: routeName, quantities: {}, total: 0 });
      }
      const row = routeMap.get(routeId)!;
      order.items.forEach((item) => {
        productMap.set(item.productId, {
          id: item.productId,
          name: item.name,
          category: item.product.categoryRef?.name || item.product.category
        });
        const quantity = Number(item.quantity);
        row.quantities[item.productId] = (row.quantities[item.productId] || 0) + quantity;
        row.total += quantity;
      });
    });

    const products = Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const routes = Array.from(routeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return {
      date: filters.date,
      products,
      routes,
      totals: products.reduce<Record<string, number>>((acc, product) => {
        acc[product.id] = routes.reduce((sum, route) => sum + (route.quantities[product.id] || 0), 0);
        return acc;
      }, {}),
      orderCount: orders.length
    };
  }
};
