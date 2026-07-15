import type { AccessTokenPayload } from "../../utils/tokens.js";
import { HttpError } from "../../utils/http.js";
import { enabledPipelineStages, nextStageAfterActor, type OrderPipelineActor } from "./order-pipeline.js";
import { ordersRepository } from "./orders.repository.js";
import type { CreateOrderInput, CustomerPaymentInput, RepeatOrdersInput, RouteInvoicePaymentInput, UpdateOrderStatusInput } from "./orders.schemas.js";

type OrderFilters = {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  routeId?: string;
  customerIds?: string[];
  routeIds?: string[];
  search?: string;
  page?: number;
  pageSize?: number;
};

async function vehicleRouteIds(tenantId: string, auth: AccessTokenPayload | undefined) {
  if (auth?.actorType !== "vehicle" || !auth.vehicleId) return null;
  const vehicle = await ordersRepository.findVehicleRoutes(tenantId, auth.vehicleId);
  if (!vehicle) {
    throw new HttpError(403, "Vehicle workspace access required");
  }
  return vehicle.routes.map((route) => route.id);
}

function orderRouteId(order: Awaited<ReturnType<typeof ordersRepository.findOrder>>) {
  return order?.routeId || order?.customer.routeId || null;
}

const naturalSort = new Intl.Collator("en-IN", { numeric: true, sensitivity: "base" });

function updatedAscending(a: { updatedAt?: Date | string | null; name: string }, b: { updatedAt?: Date | string | null; name: string }) {
  const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return aTime - bTime || naturalSort.compare(a.name || "", b.name || "");
}

function newestDate(current: Date | string | null | undefined, candidate: Date | string | null | undefined) {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

function productSort(a: { name: string; category: string; updatedAt?: Date | string | null }, b: { name: string; category: string; updatedAt?: Date | string | null }) {
  return updatedAscending(a, b) || naturalSort.compare(a.category || "General", b.category || "General");
}

function customerDefaultDueAt() {
  const dueAt = new Date();
  dueAt.setUTCDate(dueAt.getUTCDate() + 1);
  return new Date(Date.UTC(dueAt.getUTCFullYear(), dueAt.getUTCMonth(), dueAt.getUTCDate()));
}

async function buildOrderPayload(tenantId: string, customerId: string, input: CreateOrderInput) {
  const customer = await ordersRepository.findCustomer(tenantId, customerId);
  if (!customer) {
    throw new HttpError(404, "Customer not found");
  }
  const positiveItems = input.items.filter((item) => Number(item.quantity || 0) > 0);
  if (!positiveItems.length) {
    throw new HttpError(422, "At least one product quantity is required");
  }

  const products = await ordersRepository.findProducts(
    tenantId,
    positiveItems.map((item) => item.productId),
    customerId,
    customer.routeId
  );

  if (products.length !== positiveItems.length) {
    throw new HttpError(422, "One or more products are unavailable");
  }

  const orderItems = positiveItems.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId)!;
    const pricedProduct = product as typeof product & { customerPrices?: Array<{ price: unknown }>; routePrices?: Array<{ price: unknown }> };
    const unitPrice = Number(pricedProduct.customerPrices?.[0]?.price || pricedProduct.routePrices?.[0]?.price || product.unitPrice);
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

async function assertOneOrderPerCustomerDate(tenantId: string, customerId: string, input: CreateOrderInput, excludeOrderId?: string) {
  const orderDate = input.dueAt || new Date();
  const existing = await ordersRepository.findCustomerOrderOnDate(tenantId, customerId, orderDate, excludeOrderId);
  if (existing) {
    throw new HttpError(409, "Only one order is allowed per customer for the selected order date");
  }
}

async function assertRouteNotLockedForVehicle(tenantId: string, auth: AccessTokenPayload | undefined, order: { routeId?: string | null; dueAt?: Date | null; createdAt: Date; customer?: { routeId?: string | null } | null }) {
  if (auth?.actorType !== "vehicle") return;
  const routeId = order.routeId || order.customer?.routeId;
  if (!routeId) return;
  const orderDate = order.dueAt || order.createdAt;
  const lock = await ordersRepository.findRouteOrderLock(tenantId, routeId, orderDate);
  if (lock) {
    throw new HttpError(423, "Orders are locked for this route and date");
  }
}

function pipelineActorForAuth(auth: AccessTokenPayload | undefined): OrderPipelineActor | undefined {
  if (auth?.actorType === "customer") return "CUSTOMER";
  if (auth?.actorType === "vehicle") return "VEHICLE";
  if (auth?.actorType === "bakery_user") return "BAKERY";
  return undefined;
}

async function pipelineStagesForTenant(tenantId: string) {
  const config = await ordersRepository.findTenantPipeline(tenantId);
  return enabledPipelineStages(config?.orderPipelineStages, config?.orderPipelineEnabled ?? true);
}

export const ordersService = {
  cleanupExpiredPendingOrders() {
    return ordersRepository.cleanupExpiredPendingOrders();
  },

  async listOrders(tenantId: string, auth: AccessTokenPayload | undefined, filters: OrderFilters = {}) {
    await ordersRepository.cleanupExpiredPendingOrders();

    if (auth?.actorType === "customer") {
      return ordersRepository.listForCustomer(tenantId, auth.customerId!, filters);
    }

    if (auth?.actorType === "vehicle") {
      return vehicleRouteIds(tenantId, auth).then((routeIds) => ordersRepository.listForVehicle(tenantId, routeIds || [], filters));
    }

    return ordersRepository.listForStaff(tenantId, filters);
  },

  async createOrder(tenantId: string, auth: AccessTokenPayload | undefined, input: CreateOrderInput) {
    if (auth?.actorType === "customer" && input.source !== "CUSTOMER_PORTAL") {
      throw new HttpError(403, "Customers can only create customer portal orders");
    }
    const effectiveInput = auth?.actorType === "customer"
      ? { ...input, dueAt: customerDefaultDueAt() }
      : input;

    const resolvedCustomerId = auth?.actorType === "customer" ? auth.customerId : effectiveInput.customerId;
    if (!resolvedCustomerId) {
      throw new HttpError(422, "customerId is required for staff-created orders");
    }
    await assertOneOrderPerCustomerDate(tenantId, resolvedCustomerId, effectiveInput);
    const payload = await buildOrderPayload(tenantId, resolvedCustomerId, effectiveInput);
    const pipelineStages = await pipelineStagesForTenant(tenantId);
    const initialPipelineStage = nextStageAfterActor(pipelineStages, pipelineActorForAuth(auth));

    return ordersRepository.createOrder({
      tenantId,
      customerId: resolvedCustomerId,
      routeId: payload.customer.routeId,
      orderInput: payload.orderInput,
      totals: payload.totals,
      items: payload.items,
      pipelineStage: initialPipelineStage
    });
  },

  async updateOrder(tenantId: string, auth: AccessTokenPayload | undefined, orderId: string, input: CreateOrderInput) {
    const existing = await ordersRepository.findOrder(tenantId, orderId);
    if (!existing) {
      throw new HttpError(404, "Order not found");
    }
    const routeIds = await vehicleRouteIds(tenantId, auth);
    if (routeIds && !routeIds.includes(orderRouteId(existing) || "")) {
      throw new HttpError(403, "This order is not assigned to this vehicle");
    }
    await assertRouteNotLockedForVehicle(tenantId, auth, existing);
    if (auth?.actorType !== "vehicle" && existing.status !== "PENDING") {
      throw new HttpError(422, "Only pending orders can be edited");
    }
    if (auth?.actorType === "customer") {
      if (existing.customerId !== auth.customerId) {
        throw new HttpError(403, "This order does not belong to this customer");
      }
      if (existing.vehicleStatus === "ACCEPTED" || existing.status === "ACCEPTED") {
        throw new HttpError(422, "Accepted orders can only be edited by the vehicle");
      }
      if (input.customerId && input.customerId !== auth.customerId) {
        throw new HttpError(403, "Customers cannot move orders to another customer");
      }
    }
    const effectiveInput = auth?.actorType === "customer"
      ? { ...input, dueAt: existing.dueAt || existing.createdAt }
      : input;

    const resolvedCustomerId = auth?.actorType === "customer" || auth?.actorType === "vehicle" ? existing.customerId : effectiveInput.customerId || existing.customerId;
    await assertOneOrderPerCustomerDate(tenantId, resolvedCustomerId, effectiveInput, orderId);
    const payload = await buildOrderPayload(tenantId, resolvedCustomerId, effectiveInput);
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
    const existing = await ordersRepository.findOrder(tenantId, orderId);
    if (!existing) {
      throw new HttpError(404, "Order not found");
    }
    if (auth?.actorType === "customer") {
      if (existing.customerId !== auth.customerId) {
        throw new HttpError(403, "This order does not belong to this customer");
      }
      if (input.status && input.status !== "COMPLETED") {
        throw new HttpError(403, "Customers can only confirm delivered orders");
      }
      if (input.paymentStatus === "UNPAID") {
        throw new HttpError(403, "Customers cannot clear payment history");
      }
    }
    const routeIds = await vehicleRouteIds(tenantId, auth);
    if (routeIds && !routeIds.includes(orderRouteId(existing) || "")) {
      throw new HttpError(403, "This order is not assigned to this vehicle");
    }
    await assertRouteNotLockedForVehicle(tenantId, auth, existing);
    if (auth?.actorType === "vehicle" && input.status) {
      throw new HttpError(403, "Vehicles cannot change bakery order status");
    }
    if (auth?.actorType !== "vehicle" && auth?.actorType !== "bakery_user" && input.vehicleStatus) {
      throw new HttpError(403, "Only vehicles can change vehicle order status");
    }
    const pipelineStages = await pipelineStagesForTenant(tenantId);
    const actorType = pipelineActorForAuth(auth);
    const shouldAdvancePipeline =
      (auth?.actorType === "vehicle" && input.vehicleStatus === "ACCEPTED") ||
      (auth?.actorType === "bakery_user" && input.status === "ACCEPTED");
    const nextPipelineStage = shouldAdvancePipeline ? nextStageAfterActor(pipelineStages, actorType) : undefined;
    if (input.vehicleStatus && !input.status && !input.paymentStatus) {
      return ordersRepository.updateOrderStatus({
        tenantId,
        orderId,
        vehicleStatus: input.vehicleStatus,
        pipelineStage: nextPipelineStage,
        pipelineAction: shouldAdvancePipeline ? "ACCEPTED" : "UPDATED",
        pipelineActorId: auth?.sub
      });
    }

    const paid = existing.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const grandTotal = Number(existing.grandTotal || 0);
    const due = Math.max(grandTotal - paid, 0);
    const hasExistingPayment = existing.payments.length > 0;
    let payment: { amount: number; method: string; reference?: string } | undefined;

    if (input.paymentStatus === "PARTIAL") {
      if (!input.paymentAmount) {
        throw new HttpError(422, "Partial payment amount is required");
      }
      const maxPaymentAmount = hasExistingPayment ? grandTotal : due;
      if (input.paymentAmount > maxPaymentAmount) {
        throw new HttpError(422, `Partial payment amount cannot be greater than ${hasExistingPayment ? "order amount" : "due amount"}`);
      }
      payment = { amount: input.paymentAmount, method: input.paymentMethod || "Cash", reference: input.reference };
    }

    if (input.paymentStatus === "PAID" && (due > 0 || hasExistingPayment)) {
      payment = { amount: grandTotal, method: input.paymentMethod || "Cash", reference: input.reference };
    }

    if (input.paymentStatus === "UNPAID" && paid > 0) {
      throw new HttpError(422, "Cannot mark unpaid because payments already exist");
    }

    return ordersRepository.updateOrderStatus({
      tenantId,
      orderId,
      status: input.status,
      vehicleStatus: input.vehicleStatus,
      paymentStatus: input.paymentStatus,
      payment,
      pipelineStage: nextPipelineStage,
      pipelineAction: shouldAdvancePipeline ? "ACCEPTED" : undefined,
      pipelineActorId: auth?.sub
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

  async routeStatement(tenantId: string, auth: AccessTokenPayload | undefined, filters: { startDate: string; endDate: string; routeId?: string; routeIds?: string[] }) {
    const assignedRouteIds = await vehicleRouteIds(tenantId, auth);
    const orders = await ordersRepository.listForRange(tenantId, {
      ...filters,
      routeIds: assignedRouteIds || filters.routeIds
    });
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

  routeInvoiceSummary(tenantId: string, auth: AccessTokenPayload | undefined, date: string) {
    if (auth?.actorType !== "bakery_user") {
      throw new HttpError(403, "Bakery access required");
    }
    return ordersRepository.routeInvoiceSummary(tenantId, date);
  },

  async recordRouteInvoicePayment(tenantId: string, auth: AccessTokenPayload | undefined, routeId: string, input: RouteInvoicePaymentInput) {
    if (auth?.actorType !== "bakery_user") {
      throw new HttpError(403, "Bakery access required");
    }
    const result = await ordersRepository.recordRoutePayment(tenantId, routeId, input);
    if (!result) {
      throw new HttpError(404, "Route not found");
    }
    if (result.appliedAmount <= 0) {
      throw new HttpError(422, "No due orders found for this route");
    }
    return result;
  },

  async setRouteInvoiceLock(tenantId: string, auth: AccessTokenPayload | undefined, routeId: string, input: { date: string; locked: boolean }) {
    if (auth?.actorType !== "bakery_user") {
      throw new HttpError(403, "Bakery access required");
    }
    const result = await ordersRepository.setRouteOrderLock(tenantId, routeId, input.date, input.locked, auth.sub);
    if (!result) {
      throw new HttpError(404, "Route not found");
    }
    return result;
  },

  async recordCustomerPayment(tenantId: string, auth: AccessTokenPayload | undefined, customerId: string, input: CustomerPaymentInput) {
    if (auth?.actorType !== "bakery_user" && auth?.actorType !== "vehicle" && auth?.actorType !== "customer") {
      throw new HttpError(403, "Bakery, vehicle, or customer access required");
    }
    if (auth?.actorType === "customer") {
      if (!auth.customerId) {
        throw new HttpError(403, "Customer access required");
      }
      customerId = auth.customerId;
    }
    if (auth?.actorType === "vehicle") {
      const routeIds = await vehicleRouteIds(tenantId, auth);
      const customer = await ordersRepository.findCustomer(tenantId, customerId);
      if (!customer?.routeId || !routeIds?.includes(customer.routeId)) {
        throw new HttpError(403, "This customer is not assigned to this vehicle");
      }
    }
    if ((input.mode === "PARTIAL" || input.mode === "ORDER_FULL") && !input.orderId) {
      throw new HttpError(422, "Order is required for this payment type");
    }
    if (input.mode === "PARTIAL" && !input.amount) {
      throw new HttpError(422, "Partial payment amount is required");
    }

    const result = await ordersRepository.recordCustomerPayment(tenantId, customerId, input);
    if (!result) {
      throw new HttpError(404, "Customer not found");
    }
    if (result.appliedAmount <= 0) {
      throw new HttpError(422, "No due orders found for this customer");
    }
    return result;
  },

  customerDaySummary(tenantId: string, auth: AccessTokenPayload | undefined, date: string) {
    if (auth?.actorType !== "customer" || !auth.customerId) {
      throw new HttpError(403, "Customer access required");
    }
    return ordersRepository.customerDaySummary(tenantId, auth.customerId, date);
  },

  async truckLoading(tenantId: string, filters: { date: string; categoryId?: string; groupBy?: string }, auth?: AccessTokenPayload) {
    const routeIds = await vehicleRouteIds(tenantId, auth);
    const groupByCustomer = auth?.actorType === "vehicle" || filters.groupBy === "customer";
    const bakeryVisibleOnly = auth?.actorType !== "vehicle";
    const [orders, routeTotals, baseProducts, baseRows] = await Promise.all([
      ordersRepository.truckLoading(tenantId, { ...filters, routeIds: routeIds || undefined, bakeryVisibleOnly }),
      groupByCustomer
        ? ordersRepository.truckLoadingCustomerTotals(tenantId, { date: filters.date, routeIds: routeIds || undefined, bakeryVisibleOnly })
        : ordersRepository.truckLoadingRouteTotals(tenantId, { date: filters.date, routeIds: routeIds || undefined, bakeryVisibleOnly }),
      ordersRepository.truckLoadingProducts(tenantId, { categoryId: filters.categoryId }),
      groupByCustomer
        ? ordersRepository.truckLoadingCustomers(tenantId, { routeIds: routeIds || undefined })
        : ordersRepository.truckLoadingRoutes(tenantId, { routeIds: routeIds || undefined })
    ]);
    const productMap = new Map<string, { id: string; name: string; category: string; updatedAt: Date | string | null }>();
    const rowTotalsMap = groupByCustomer
      ? new Map(routeTotals.map((row) => ["customerId" in row ? row.customerId : row.routeId, row]))
      : new Map(routeTotals.map((row) => ["routeId" in row ? row.routeId : row.customerId, row]));
    const routeMap = new Map<string, { id: string; name: string; routeName?: string | null; updatedAt: Date | string | null; quantities: Record<string, number>; total: number; previousDue: number; orderAmount: number; paidAmount: number; todaysDue: number; customerCount: number; customerIds: Set<string> }>();

    baseProducts.forEach((product) => {
      productMap.set(product.id, {
        id: product.id,
        name: product.name,
        category: product.categoryRef?.name || product.category,
        updatedAt: product.updatedAt
      });
    });

    baseRows.forEach((baseRow) => {
      const totals = rowTotalsMap.get(baseRow.id);
      routeMap.set(baseRow.id, {
        id: baseRow.id,
        name: baseRow.name,
        routeName: groupByCustomer && "route" in baseRow ? baseRow.route?.name || null : null,
        updatedAt: baseRow.updatedAt,
        quantities: {},
        total: 0,
        previousDue: totals?.previousDue || 0,
        orderAmount: totals?.orderAmount || 0,
        paidAmount: totals?.paidAmount || 0,
        todaysDue: totals?.todaysDue || 0,
        customerCount: groupByCustomer ? 1 : ("_count" in baseRow ? baseRow._count.customers : 0),
        customerIds: new Set<string>(groupByCustomer ? [baseRow.id] : [])
      });
    });

    orders.forEach((order) => {
      const route = order.route || order.customer.route;
      const rowId = groupByCustomer ? order.customerId : route?.id || "no-route";
      const rowName = groupByCustomer ? order.customer.name : route?.name || "No route";
      const rowRouteName = groupByCustomer ? route?.name || null : null;
      const rowUpdatedAt = groupByCustomer ? order.customer.updatedAt : route?.updatedAt || order.updatedAt;
      if (!routeMap.has(rowId)) {
        const totals = rowTotalsMap.get(rowId);
        routeMap.set(rowId, {
          id: rowId,
          name: rowName,
          routeName: rowRouteName,
          updatedAt: rowUpdatedAt,
          quantities: {},
          total: 0,
          previousDue: totals?.previousDue || 0,
          orderAmount: totals?.orderAmount || 0,
          paidAmount: totals?.paidAmount || 0,
          todaysDue: totals?.todaysDue || 0,
          customerCount: 0,
          customerIds: new Set<string>()
        });
      }
      const row = routeMap.get(rowId)!;
      row.routeName = row.routeName || rowRouteName;
      row.updatedAt = newestDate(row.updatedAt, rowUpdatedAt) || null;
      row.customerIds.add(order.customerId);
      order.items.forEach((item) => {
        const existingProduct = productMap.get(item.productId);
        const productUpdatedAt = newestDate(existingProduct?.updatedAt, item.product.updatedAt) || null;
        productMap.set(item.productId, {
          id: item.productId,
          name: item.name,
          category: item.product.categoryRef?.name || item.product.category,
          updatedAt: productUpdatedAt
        });
        const quantity = Number(item.quantity);
        row.quantities[item.productId] = (row.quantities[item.productId] || 0) + quantity;
        row.total += quantity;
      });
    });

    const products = Array.from(productMap.values()).sort(productSort);
    const routes = Array.from(routeMap.values()).map((row) => {
      const { customerIds, ...route } = row;
      return { ...route, customerCount: Math.max(route.customerCount, customerIds.size) };
    }).sort(updatedAscending);
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
