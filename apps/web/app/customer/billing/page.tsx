"use client";

import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { Download, Eye, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaymentHistory, paymentTotal } from "../../../components/payment-history";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Order = {
  id: string;
  paymentStatus: string;
  grandTotal: string | number;
  createdAt: string;
  dueAt?: string | null;
  invoice?: { invoiceNumber: string; paymentStatus: string; total: string | number } | null;
  payments?: { id: string; amount: string | number; method?: string | null; reference?: string | null; paidAt?: string | null }[];
  items?: { id: string; name: string; quantity: string | number; unitPrice: string | number; lineTotal: string | number }[];
};
type DaySummary = { previousDue: number; todayOrderAmount: number; todayPaid: number; todaysDue: number; totalDue: number };

const paymentMethods = ["Cash", "UPI"];
const paymentTypes = [
  { value: "PARTIAL", label: "Partial" },
  { value: "ORDER_FULL", label: "Order Full Payment" },
  { value: "DUE_FULL", label: "Due Full Payment" }
];

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function paid(order: Order) {
  return paymentTotal(order.payments);
}

function totalAmount(previousDue: number, orderAmount: string | number) {
  return Number(previousDue || 0) + Number(orderAmount || 0);
}

function todaysDueAmount(previousDue: number, orderAmount: string | number, paidAmount: string | number) {
  return Math.max(totalAmount(previousDue, orderAmount) - Number(paidAmount || 0), 0);
}

function formatQty(value?: string | number | null) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printInvoicePdf(html: string) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}

export default function CustomerBillingPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
  const [date, setDate] = useState(localDateInput());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadOrders() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const [data, summaryData] = await Promise.all([
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?startDate=${date}&endDate=${date}&pageSize=100`),
        authFetch<{ summary: DaySummary }>(`${apiBase}/orders/customer-day-summary?date=${date}`)
      ]);
      setOrders(data.orders);
      setSummary(summaryData.summary);
    } catch (error) {
      toast.error("Could not load billing", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, [date]);

  const totals = useMemo(() => {
    const orderTotal = orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
    const paidTotal = orders.reduce((sum, order) => sum + paid(order), 0);
    const previousDue = summary?.previousDue || 0;
    const total = totalAmount(previousDue, orderTotal);
    return { previousDue, orderTotal, totalAmount: total, paidTotal, todaysDue: Math.max(total - paidTotal, 0), invoices: orders.filter((order) => order.invoice).length };
  }, [orders, summary]);

  function exportOrder(order: Order) {
    const invoiceNumber = order.invoice?.invoiceNumber || `Order ${order.id.slice(-6).toUpperCase()}`;
    const paymentRows = (order.payments || []).map((payment, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(formatDate(payment.paidAt))}</td>
        <td>${escapeHtml(payment.method || "Cash")}</td>
        <td>${escapeHtml(payment.reference || "")}</td>
        <td style="text-align:right;">${escapeHtml(formatAmount(payment.amount))}</td>
      </tr>
    `).join("");
    const productRows = (order.items || []).map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td style="text-align:right;">${escapeHtml(formatQty(item.quantity))}</td>
        <td style="text-align:right;">${escapeHtml(formatAmount(item.unitPrice))}</td>
        <td style="text-align:right;">${escapeHtml(formatAmount(item.lineTotal))}</td>
      </tr>
    `).join("");
    const previousDueAmount = totals.previousDue;
    const orderAmount = Number(order.grandTotal || 0);
    const paidAmount = paid(order);
    const fullAmount = totalAmount(previousDueAmount, orderAmount);
    const todaysDue = todaysDueAmount(previousDueAmount, orderAmount, paidAmount);
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoiceNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #172033; margin: 32px; }
    h1 { margin: 0 0 4px; }
    .muted { color: #64748b; }
    .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #dbe3ef; padding-bottom: 18px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border-bottom: 1px solid #dbe3ef; padding: 10px; text-align: left; }
    th { background: #f3f6fa; font-size: 12px; text-transform: uppercase; color: #64748b; }
    .totals { margin-left: auto; margin-top: 24px; width: 320px; }
    .totals div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbe3ef; }
    .strong { font-weight: 700; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>${escapeHtml(invoiceNumber)}</h1>
      <div class="muted">Order ${escapeHtml(order.id)}</div>
    </div>
    <div>
      <div class="muted">Order date: ${escapeHtml(formatDate(order.dueAt || order.createdAt))}</div>
      <div class="muted">Payment status: ${escapeHtml(order.invoice?.paymentStatus || order.paymentStatus)}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Product</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead>
    <tbody>${productRows || '<tr><td colspan="4" class="muted">No products found.</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div><span>Previous Due Amount</span><span>${escapeHtml(formatAmount(previousDueAmount))}</span></div>
    <div><span>Order Amount</span><span>${escapeHtml(formatAmount(orderAmount))}</span></div>
    <div><span>Total Amount</span><span>${escapeHtml(formatAmount(fullAmount))}</span></div>
    <div><span>Paid Amount</span><span>${escapeHtml(formatAmount(paidAmount))}</span></div>
    <div class="strong"><span>Today's Due Amount</span><span>${escapeHtml(formatAmount(todaysDue))}</span></div>
  </div>
  <h2>Payment History</h2>
  <table>
    <thead><tr><th>#</th><th>Date</th><th>Method</th><th>Reference</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${paymentRows || '<tr><td colspan="5" class="muted">No payment recorded.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
    if (!printInvoicePdf(html)) {
      toast.error("PDF export blocked", "Allow pop-ups to print or save this invoice as PDF.");
    }
  }

  function paymentAmountForType(order: Order, type: string) {
    if (type === "ORDER_FULL") return Number(order.grandTotal || 0);
    if (type === "DUE_FULL") return todaysDueAmount(totals.previousDue, order.grandTotal, paid(order));
    return 0;
  }

  function startPayment(order: Order, type = "PARTIAL") {
    const existingPayment = order.payments?.[0];
    const amount = existingPayment ? Number(existingPayment.amount || 0) : paymentAmountForType(order, type);
    setPaymentOrder(order);
    setPaymentForm({
      type,
      amount: amount ? String(amount) : "",
      method: existingPayment?.method || "Cash",
      reference: existingPayment?.reference || ""
    });
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !paymentOrder) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/customers/me/payments`, {
        method: "POST",
        body: JSON.stringify({
          mode: paymentForm.type,
          orderId: paymentOrder.id,
          date,
          amount: paymentForm.type === "PARTIAL" ? Number(paymentForm.amount) : undefined,
          method: paymentForm.method,
          reference: paymentForm.reference || undefined
        })
      });
      toast.success("Payment saved", "Your payment was updated for this invoice.");
      setPaymentOrder(null);
      setPaymentForm({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
      await loadOrders();
    } catch (error) {
      toast.error("Payment failed", error instanceof Error ? error.message : "Could not save this payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Customer Portal" subtitle="Invoices, payments, and balances" surface="customer">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Billing</h1>
              <p className="mt-1 text-sm text-muted">Order-wise payment history and invoice status.</p>
            </div>
            <div className="hidden flex-wrap gap-x-4 gap-y-2 text-sm text-muted md:flex">
              <span>Previous Due Amount: <span className="font-semibold text-ink">{formatAmount(totals.previousDue)}</span></span>
              <span>Order Amount: <span className="font-semibold text-ink">{formatAmount(totals.orderTotal)}</span></span>
              <span>Total Amount: <span className="font-semibold text-ink">{formatAmount(totals.totalAmount)}</span></span>
              <span>Paid Amount: <span className="font-semibold text-ink">{formatAmount(totals.paidTotal)}</span></span>
              <span>Today&apos;s Due Amount: <span className="font-semibold text-ink">{formatAmount(totals.todaysDue)}</span></span>
              <span>Invoices: <span className="font-semibold text-ink">{totals.invoices}</span></span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[150px_40px]">
              <label className="grid gap-1 text-sm font-semibold">Date<DateInput className="h-10 rounded-md border border-line bg-panel2 px-3 outline-none focus:border-mint" onChange={setDate} value={date} /></label>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2 sm:self-end" onClick={loadOrders} title="Refresh billing" type="button"><RefreshCw size={16} /></button>
            </div>
          </div>
          {loading ? <LoadingSpinner label="Loading billing" /> : null}
          <div className="hidden max-h-[680px] overflow-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Invoice / Order</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Previous Due Amount</th>
                  <th className="px-4 py-3 text-right">Order Amount</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Today&apos;s Due Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => {
                  const paidTotal = paid(order);
                  const fullAmount = totalAmount(totals.previousDue, order.grandTotal);
                  return (
                    <Fragment key={order.id}>
                    <tr>
                      <td className="px-4 py-3 font-semibold">{order.invoice?.invoiceNumber || `Order ${order.id.slice(-6).toUpperCase()}`}</td>
                      <td className="px-4 py-3">{formatDate(order.dueAt || order.createdAt)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(totals.previousDue)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(order.grandTotal)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(fullAmount)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(paidTotal)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-berry">{formatAmount(todaysDueAmount(totals.previousDue, order.grandTotal, paidTotal))}</td>
                      <td className="px-4 py-3">{order.invoice?.paymentStatus || order.paymentStatus}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => setDetailOrder(order)} title="Show invoice details" type="button"><Eye size={15} /></button>
                          <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => exportOrder(order)} title="Export PDF" type="button"><Download size={15} /></button>
                          <button className="focus-ring h-9 rounded-md bg-mint px-3 text-xs font-semibold text-white disabled:opacity-50" disabled={saving || (todaysDueAmount(totals.previousDue, order.grandTotal, paidTotal) <= 0 && !order.payments?.length)} onClick={() => startPayment(order)} type="button">{order.payments?.length ? "Edit payment" : "Record payment"}</button>
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-panel2/30">
                      <td className="px-4 py-3" colSpan={9}>
                        <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
                {!loading && !orders.length ? <tr><td className="px-4 py-8 text-center text-muted" colSpan={9}>No billing records yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-3 sm:hidden">
            {orders.map((order) => {
              const paidTotal = paid(order);
              const fullAmount = totalAmount(totals.previousDue, order.grandTotal);
              return (
                <article className="rounded-lg border border-line bg-panel2 p-4" key={order.id}>
                  <h2 className="font-semibold">{order.invoice?.invoiceNumber || `Order ${order.id.slice(-6).toUpperCase()}`}</h2>
                  <p className="mt-1 text-sm text-muted">{formatDate(order.dueAt || order.createdAt)} · {order.invoice?.paymentStatus || order.paymentStatus}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <span>Previous Due Amount<br /><strong>{formatAmount(totals.previousDue)}</strong></span>
                    <span>Order Amount<br /><strong>{formatAmount(order.grandTotal)}</strong></span>
                    <span>Total Amount<br /><strong>{formatAmount(fullAmount)}</strong></span>
                    <span>Paid Amount<br /><strong>{formatAmount(paidTotal)}</strong></span>
                    <span>Today&apos;s Due Amount<br /><strong>{formatAmount(todaysDueAmount(totals.previousDue, order.grandTotal, paidTotal))}</strong></span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" onClick={() => setDetailOrder(order)} type="button"><Eye size={15} /> Details</button>
                    <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" onClick={() => exportOrder(order)} type="button"><Download size={15} /> PDF</button>
                    <button className="focus-ring rounded-md bg-mint px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || (todaysDueAmount(totals.previousDue, order.grandTotal, paidTotal) <= 0 && !order.payments?.length)} onClick={() => startPayment(order)} type="button">{order.payments?.length ? "Edit payment" : "Record payment"}</button>
                  </div>
                  <div className="mt-3">
                    <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
      <Modal open={Boolean(detailOrder)} title="Invoice details" description={detailOrder?.invoice?.invoiceNumber || (detailOrder ? `Order ${detailOrder.id.slice(-6).toUpperCase()}` : "")} onClose={() => setDetailOrder(null)}>
        {detailOrder ? (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-lg border border-line bg-panel2 p-4 sm:grid-cols-5">
              <span>Previous Due Amount<br /><strong>{formatAmount(totals.previousDue)}</strong></span>
              <span>Order Amount<br /><strong>{formatAmount(detailOrder.grandTotal)}</strong></span>
              <span>Total Amount<br /><strong>{formatAmount(totalAmount(totals.previousDue, detailOrder.grandTotal))}</strong></span>
              <span>Paid Amount<br /><strong>{formatAmount(paid(detailOrder))}</strong></span>
              <span>Today&apos;s Due Amount<br /><strong>{formatAmount(todaysDueAmount(totals.previousDue, detailOrder.grandTotal, paid(detailOrder)))}</strong></span>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 bg-panel2 text-xs uppercase text-muted">
                  <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(detailOrder.items || []).map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold">{item.name}</td>
                      <td className="px-4 py-3 text-right">{formatQty(item.quantity)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaymentHistory payments={detailOrder.payments} total={detailOrder.grandTotal} />
            <div className="flex justify-end">
              <button className="focus-ring rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || (todaysDueAmount(totals.previousDue, detailOrder.grandTotal, paid(detailOrder)) <= 0 && !detailOrder.payments?.length)} onClick={() => startPayment(detailOrder)} type="button">{detailOrder.payments?.length ? "Edit payment" : "Record payment"}</button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal open={Boolean(paymentOrder)} title={paymentOrder?.payments?.length ? "Edit payment" : "Record payment"} description="Save the single payment amount for this invoice." onClose={() => setPaymentOrder(null)}>
        {paymentOrder ? (
          <form className="grid gap-4" onSubmit={recordPayment}>
            <label className="grid gap-1 text-sm font-semibold">Payment type<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => {
              const type = event.target.value;
              setPaymentForm((current) => ({
                ...current,
                type,
                amount: type === "PARTIAL" ? "" : String(paymentAmountForType(paymentOrder, type) || ""),
                method: current.method
              }));
            }} value={paymentForm.type}>{paymentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Amount<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" max={paymentForm.type === "PARTIAL" ? totalAmount(totals.previousDue, paymentOrder.grandTotal) : undefined} min="1" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} readOnly={paymentForm.type !== "PARTIAL"} required type="number" value={paymentForm.amount} /></label>
            <label className="grid gap-1 text-sm font-semibold">Payment method<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))} value={paymentForm.method}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Reference<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} value={paymentForm.reference} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setPaymentOrder(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Payment"}</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </AppShell>
  );
}
