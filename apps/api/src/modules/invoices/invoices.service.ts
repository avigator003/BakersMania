import { HttpError } from "../../utils/http.js";
import { invoicesRepository } from "./invoices.repository.js";

export const invoicesService = {
  async createFromOrder(tenantId: string, orderId: string) {
    const order = await invoicesRepository.findOrderWithInvoice(tenantId, orderId);

    if (!order) {
      throw new HttpError(404, "Order not found");
    }
    if (order.invoice) {
      return order.invoice;
    }

    const invoiceCount = await invoicesRepository.countInvoices(tenantId);
    return invoicesRepository.createInvoice({
      tenantId,
      orderId: order.id,
      invoiceNumber: `INV-${String(invoiceCount + 1).padStart(5, "0")}`,
      total: order.grandTotal,
      paymentStatus: order.paymentStatus
    });
  },

  listInvoices(tenantId: string) {
    return invoicesRepository.listInvoices(tenantId);
  }
};
