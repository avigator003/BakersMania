"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
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
};

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

export default function CustomerBillingPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadOrders() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const data = await authFetch<{ orders: Order[] }>(`${apiBase}/orders`);
      setOrders(data.orders);
    } catch (error) {
      toast.error("Could not load billing", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const totals = useMemo(() => {
    const orderTotal = orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
    const paidTotal = orders.reduce((sum, order) => sum + paid(order), 0);
    return { orderTotal, paidTotal, due: Math.max(orderTotal - paidTotal, 0), invoices: orders.filter((order) => order.invoice).length };
  }, [orders]);

  return (
    <AppShell title="Customer Portal" subtitle="Invoices, payments, and balances" surface="customer">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex items-center justify-between gap-3 border-b border-line p-4">
            <div>
              <h1 className="text-xl font-semibold">Billing</h1>
              <p className="mt-1 text-sm text-muted">Order-wise payment history and invoice status.</p>
            </div>
            <div className="hidden flex-wrap gap-x-4 gap-y-2 text-sm text-muted md:flex">
              <span>Total: <span className="font-semibold text-ink">{formatAmount(totals.orderTotal)}</span></span>
              <span>Paid: <span className="font-semibold text-ink">{formatAmount(totals.paidTotal)}</span></span>
              <span>Due: <span className="font-semibold text-ink">{formatAmount(totals.due)}</span></span>
              <span>Invoices: <span className="font-semibold text-ink">{totals.invoices}</span></span>
            </div>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadOrders} title="Refresh billing" type="button"><RefreshCw size={16} /></button>
          </div>
          {loading ? <p className="p-4 text-sm text-muted">Loading billing...</p> : null}
          <div className="hidden max-h-[680px] overflow-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Invoice / Order</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3">Status</th>
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
                      <td className="px-4 py-3 text-right">{formatAmount(order.grandTotal)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(paidTotal)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-berry">{formatAmount(paymentDue(order.grandTotal, order.payments))}</td>
                      <td className="px-4 py-3">{order.invoice?.paymentStatus || order.paymentStatus}</td>
                    </tr>
                    <tr className="bg-panel2/30">
                      <td className="px-4 py-3" colSpan={6}>
                        <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                      </td>
                    </tr>
                    </Fragment>
                  );
                })}
                {!loading && !orders.length ? <tr><td className="px-4 py-8 text-center text-muted" colSpan={6}>No billing records yet.</td></tr> : null}
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
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <span>Total<br /><strong>{formatAmount(order.grandTotal)}</strong></span>
                    <span>Paid<br /><strong>{formatAmount(paidTotal)}</strong></span>
                    <span>Due<br /><strong>{formatAmount(paymentDue(order.grandTotal, order.payments))}</strong></span>
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
    </AppShell>
  );
}
