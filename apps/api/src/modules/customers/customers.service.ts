import bcrypt from "bcryptjs";
import { HttpError } from "../../utils/http.js";
import { customersRepository } from "./customers.repository.js";
import type { CustomerListFilters } from "./customers.repository.js";
import type { CustomerInput, CustomerUpdateInput } from "./customers.schemas.js";

function normalizePhone(value?: string | null) {
  return (value || "").replace(/[^\d+]/g, "");
}

function customerEmail(tenantId: string, phone: string, email?: string) {
  return email || `customer-${tenantId}-${phone.replace(/[^\d]/g, "")}@bakersmania.local`;
}

function withBalance(
  customer: Awaited<ReturnType<typeof customersRepository.listByTenant>>["customers"][number],
  summary?: { orderTotal: number; paidTotal: number }
) {
  const orderTotal = summary?.orderTotal || 0;
  const paidTotal = summary?.paidTotal || 0;
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
  async listCustomers(tenantId: string, filters: CustomerListFilters = {}) {
    const result = await customersRepository.listByTenant(tenantId, filters);
    const summaries = await customersRepository.financialSummaryByCustomer(tenantId, result.customers.map((customer) => customer.id));
    return {
      customers: result.customers.map((customer) => withBalance(customer, summaries.get(customer.id))),
      pagination: result.pagination
    };
  },

  async createCustomer(actorType: string | undefined, tenantId: string, input: CustomerInput) {
    if (actorType !== "bakery_user") {
      throw new HttpError(403, "Only bakery staff can create customers here");
    }
    const phone = normalizePhone(input.phone);
    if (!phone) {
      throw new HttpError(422, "Customer phone number is required for portal credentials");
    }
    if (input.routeId) {
      const route = await customersRepository.findRoute(tenantId, input.routeId);
      if (!route) {
        throw new HttpError(400, "Selected route does not belong to this bakery");
      }
    }
    const passwordHash = await bcrypt.hash("123456", 12);
    const user = await customersRepository.upsertPortalUser({
      email: customerEmail(tenantId, phone, input.email),
      name: input.name,
      phone,
      passwordHash
    });
    return customersRepository.create(tenantId, { ...input, phone, userId: user.id });
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
    const phone = normalizePhone(input.phone);
    if (!phone) {
      throw new HttpError(422, "Customer phone number is required for portal credentials");
    }
    const passwordHash = await bcrypt.hash("123456", 12);
    const user = await customersRepository.upsertPortalUser({
      email: customerEmail(tenantId, phone, input.email || customer.email || undefined),
      name: input.name || customer.name,
      phone,
      passwordHash
    });
    return customersRepository.update(tenantId, customerId, { ...input, phone, userId: user.id });
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
  },

  async getMyProfile(auth: Express.Request["auth"], tenantId: string) {
    if (auth?.actorType !== "customer") {
      throw new HttpError(403, "Customer access required");
    }
    const customer = await customersRepository.findByUser(tenantId, auth.sub);
    if (!customer) {
      throw new HttpError(404, "Customer profile not found");
    }
    return customersService.getLedger(tenantId, customer.id);
  },

  async updateMyProfile(auth: Express.Request["auth"], tenantId: string, input: CustomerUpdateInput) {
    if (auth?.actorType !== "customer") {
      throw new HttpError(403, "Customer access required");
    }
    const customer = await customersRepository.findByUser(tenantId, auth.sub);
    if (!customer) {
      throw new HttpError(404, "Customer profile not found");
    }
    const allowedInput: CustomerUpdateInput = {
      name: input.name,
      phone: input.phone,
      address: input.address,
      state: input.state,
      city: input.city,
      notes: input.notes
    };
    return customersRepository.update(tenantId, customer.id, allowedInput);
  }
};
