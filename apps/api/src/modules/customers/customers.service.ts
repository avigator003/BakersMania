import { HttpError } from "../../utils/http.js";
import { customersRepository } from "./customers.repository.js";
import type { CustomerInput, CustomerUpdateInput } from "./customers.schemas.js";

function withBalance(customer: Awaited<ReturnType<typeof customersRepository.listByTenant>>[number]) {
  const orderTotal = customer.orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
  const paidTotal = customer.orders.reduce(
    (sum, order) => sum + order.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0),
    0
  );
  const dueBalance = Math.max(orderTotal - paidTotal, 0);
  const creditLimit = customer.creditLimit === null || customer.creditLimit === undefined ? null : Number(customer.creditLimit);
  return {
    ...customer,
    orderTotal,
    paidTotal,
    dueBalance,
    creditExceeded: creditLimit !== null && dueBalance > creditLimit
  };
}

export const customersService = {
  listCustomers(tenantId: string) {
    return customersRepository.listByTenant(tenantId).then((customers) => customers.map(withBalance));
  },

  async createCustomer(actorType: string | undefined, tenantId: string, input: CustomerInput) {
    if (actorType !== "bakery_user") {
      throw new HttpError(403, "Only bakery staff can create customers here");
    }
    if (input.routeId) {
      const route = await customersRepository.findRoute(tenantId, input.routeId);
      if (!route) {
        throw new HttpError(400, "Selected route does not belong to this bakery");
      }
    }
    return customersRepository.create(tenantId, input);
  },

  async updateCustomer(actorType: string | undefined, tenantId: string, customerId: string, input: CustomerUpdateInput) {
    if (actorType !== "bakery_user") {
      throw new HttpError(403, "Only bakery staff can update customers here");
    }
    const customer = await customersRepository.findById(tenantId, customerId);
    if (!customer) {
      throw new HttpError(404, "Customer not found");
    }
    if (input.routeId) {
      const route = await customersRepository.findRoute(tenantId, input.routeId);
      if (!route) {
        throw new HttpError(400, "Selected route does not belong to this bakery");
      }
    }
    return customersRepository.update(tenantId, customerId, input);
  },

  async getLedger(tenantId: string, customerId: string) {
    const customer = await customersRepository.findById(tenantId, customerId);
    if (!customer) {
      throw new HttpError(404, "Customer not found");
    }

    const orderTotal = customer.orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
    const paidTotal = customer.orders.reduce(
      (sum, order) => sum + order.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount || 0), 0),
      0
    );
    const dueBalance = Math.max(orderTotal - paidTotal, 0);
    const creditLimit = customer.creditLimit === null || customer.creditLimit === undefined ? null : Number(customer.creditLimit);
    const entries = customer.orders.flatMap((order) => {
      const paid = order.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      return [
        {
          id: `${order.id}-order`,
          type: "ORDER",
          date: order.dueAt || order.createdAt,
          orderId: order.id,
          invoiceNumber: order.invoice?.invoiceNumber || null,
          description: `Order ${order.items.length} product${order.items.length === 1 ? "" : "s"}`,
          debit: Number(order.grandTotal || 0),
          credit: 0,
          balance: Number(order.grandTotal || 0) - paid
        },
        ...order.payments.map((payment) => ({
          id: payment.id,
          type: "PAYMENT",
          date: payment.paidAt,
          orderId: order.id,
          invoiceNumber: order.invoice?.invoiceNumber || null,
          description: `${payment.method}${payment.reference ? ` · ${payment.reference}` : ""}`,
          debit: 0,
          credit: Number(payment.amount || 0),
          balance: 0
        }))
      ];
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      customer,
      summary: {
        orderTotal,
        paidTotal,
        dueBalance,
        creditLimit,
        creditExceeded: creditLimit !== null && dueBalance > creditLimit
      },
      entries,
      productPrices: customer.productPrices
    };
  }
};
