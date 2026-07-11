"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Download, Eye, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaymentHistory, paymentDue, paymentTotal } from "../../../components/payment-history";
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

function formatQty(value?: string | number | null) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadFile(content: string, type: string, fileName: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CustomerBillingPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [date, setDate] = useState(localDateInput());
  const [loading, setLoading] = useState(true);
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
    return { previousDue: summary?.previousDue || 0, orderTotal, paidTotal, due: Math.max(orderTotal - paidTotal, 0), invoices: orders.filter((order) => order.invoice).length };
  }, [orders, summary]);

  function exportOrder(order: Order) {
    const rows = [
      ["Invoice", order.invoice?.invoiceNumber || `Order ${order.id}`],
      ["Date", formatDate(order.dueAt || order.createdAt)],
      ["Payment Status", order.invoice?.paymentStatus || order.paymentStatus],
      ["Previous Due", totals.previousDue],
      ["Order Amount", Number(order.grandTotal || 0)],
      ["Paid", paid(order)],
      ["Due", paymentDue(order.grandTotal, order.payments)],
      [],
      ["Product", "Quantity", "Unit Price", "Line Total"],
      ...(order.items || []).map((item) => [item.name, Number(item.quantity || 0), Number(item.unitPrice || 0), Number(item.lineTotal || 0)]),
      [],
      ["Payment Date", "Method", "Reference", "Amount"],
      ...(order.payments || []).map((payment) => [formatDate(payment.paidAt), payment.method || "Cash", payment.reference || "", Number(payment.amount || 0)])
    ];
    downloadFile(rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8", `customer-invoice-${date}-${order.id.slice(-6)}.csv`);
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
              <span>Total: <span className="font-semibold text-ink">{formatAmount(totals.orderTotal)}</span></span>
              <span>Previous Due: <span className="font-semibold text-ink">{formatAmount(totals.previousDue)}</span></span>
              <span>Paid: <span className="font-semibold text-ink">{formatAmount(totals.paidTotal)}</span></span>
              <span>Due: <span className="font-semibold text-ink">{formatAmount(totals.due)}</span></span>
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
                  <th className="px-4 py-3 text-right">Previous Due</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => {
                  const paidTotal = paid(order);
                  return (
                    <Fragment key={order.id}>
                    <tr>
                      <td className="px-4 py-3 font-semibold">{order.invoice?.invoiceNumber || `Order ${order.id.slice(-6).toUpperCase()}`}</td>
                      <td className="px-4 py-3">{formatDate(order.dueAt || order.createdAt)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(totals.previousDue)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(order.grandTotal)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(paidTotal)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-berry">{formatAmount(paymentDue(order.grandTotal, order.payments))}</td>
                      <td className="px-4 py-3">{order.invoice?.paymentStatus || order.paymentStatus}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => setDetailOrder(order)} title="Show invoice details" type="button"><Eye size={15} /></button>
                          <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => exportOrder(order)} title="Export Excel" type="button"><Download size={15} /></button>
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-panel2/30">
                      <td className="px-4 py-3" colSpan={8}>
                        <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
                {!loading && !orders.length ? <tr><td className="px-4 py-8 text-center text-muted" colSpan={8}>No billing records yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-3 sm:hidden">
            {orders.map((order) => {
              const paidTotal = paid(order);
              return (
                <article className="rounded-lg border border-line bg-panel2 p-4" key={order.id}>
                  <h2 className="font-semibold">{order.invoice?.invoiceNumber || `Order ${order.id.slice(-6).toUpperCase()}`}</h2>
                  <p className="mt-1 text-sm text-muted">{formatDate(order.dueAt || order.createdAt)} · {order.invoice?.paymentStatus || order.paymentStatus}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <span>Previous Due<br /><strong>{formatAmount(totals.previousDue)}</strong></span>
                    <span>Total<br /><strong>{formatAmount(order.grandTotal)}</strong></span>
                    <span>Paid<br /><strong>{formatAmount(paidTotal)}</strong></span>
                    <span>Due<br /><strong>{formatAmount(paymentDue(order.grandTotal, order.payments))}</strong></span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" onClick={() => setDetailOrder(order)} type="button"><Eye size={15} /> Details</button>
                    <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" onClick={() => exportOrder(order)} type="button"><Download size={15} /> Export</button>
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
            <div className="grid gap-3 rounded-lg border border-line bg-panel2 p-4 sm:grid-cols-4">
              <span>Previous Due<br /><strong>{formatAmount(totals.previousDue)}</strong></span>
              <span>Order Amount<br /><strong>{formatAmount(detailOrder.grandTotal)}</strong></span>
              <span>Paid<br /><strong>{formatAmount(paid(detailOrder))}</strong></span>
              <span>Due<br /><strong>{formatAmount(paymentDue(detailOrder.grandTotal, detailOrder.payments))}</strong></span>
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
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
