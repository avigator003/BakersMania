"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { Modal } from "../../../components/modal";
import { PaymentHistory, paymentDue, paymentTotal } from "../../../components/payment-history";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  grandTotal: string | number;
  dueAt?: string | null;
  createdAt: string;
  items: { id: string; name: string; quantity: string | number; lineTotal: string | number }[];
  payments?: { id: string; amount: string | number; method?: string | null; reference?: string | null; paidAt?: string | null }[];
};

const paymentMethods = ["Cash", "Advance", "UPI", "Bank Transfer", "Cheque"];

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

function due(order: Order) {
  return paymentDue(order.grandTotal, order.payments);
}

export default function CustomerOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partialOrder, setPartialOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "Cash", reference: "" });
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadOrders() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const data = await authFetch<{ orders: Order[] }>(`${apiBase}/orders`);
      setOrders(data.orders);
    } catch (error) {
      toast.error("Could not load orders", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const stats = useMemo(() => ({
    open: orders.filter((order) => order.status !== "COMPLETED").length,
    completed: orders.filter((order) => order.status === "COMPLETED").length,
    total: orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0)
  }), [orders]);

  async function updateOrder(order: Order, patch: { status?: string; paymentStatus?: string; paymentAmount?: number; paymentMethod?: string; reference?: string }) {
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify(patch) });
      toast.success("Order updated", patch.status ? "Delivery was confirmed." : "Payment details were updated.");
      setPartialOrder(null);
      setPaymentForm({ amount: "", method: "Cash", reference: "" });
      await loadOrders();
    } catch (error) {
      toast.error("Update failed", error instanceof Error ? error.message : "Could not update this order.");
    } finally {
      setSaving(false);
    }
  }

  function startPartial(order: Order, method = "Cash") {
    setPartialOrder(order);
    setPaymentForm({ amount: String(due(order) || ""), method, reference: "" });
  }

  async function recordPartial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!partialOrder) return;
    await updateOrder(partialOrder, {
      paymentStatus: "PARTIAL",
      paymentAmount: Number(paymentForm.amount),
      paymentMethod: paymentForm.method,
      reference: paymentForm.reference || undefined
    });
  }

  return (
    <AppShell title="Customer Portal" subtitle="Your orders, status, and bakery updates" surface="customer">
      <div className="grid gap-6">
        <section className="summary-grid">
          {[
            ["Open orders", stats.open],
            ["Completed", stats.completed],
            ["Total ordered", formatAmount(stats.total)]
          ].map(([label, value]) => (
            <div className="rounded-lg border border-line bg-panel p-4 shadow-subtle" key={label}>
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex items-center justify-between gap-3 border-b border-line p-4">
            <div>
              <h1 className="text-xl font-semibold">Order History</h1>
              <p className="mt-1 text-sm text-muted">Production, delivery, and payment status for your orders.</p>
            </div>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadOrders} title="Refresh orders" type="button"><RefreshCw size={16} /></button>
          </div>
          {loading ? <p className="p-4 text-sm text-muted">Loading orders...</p> : null}
          <div className="grid gap-3 p-3">
            {orders.map((order) => {
              const dueAmount = due(order);
              return (
              <article className="rounded-lg border border-line bg-panel2 p-4" key={order.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="font-semibold">Order {order.id.slice(-6).toUpperCase()}</h2>
                    <p className="mt-1 text-sm text-muted">{formatDate(order.dueAt || order.createdAt)} · {order.items.length} product{order.items.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-md border border-line bg-panel px-2 py-1">{order.status}</span>
                    <span className="rounded-md border border-line bg-panel px-2 py-1">{order.paymentStatus}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                  <span className="rounded-md bg-panel p-3">Order<br /><strong>{formatAmount(order.grandTotal)}</strong></span>
                  <span className="rounded-md bg-panel p-3">Paid<br /><strong>{formatAmount(paid(order))}</strong></span>
                  <span className="rounded-md bg-panel p-3">Due<br /><strong>{formatAmount(dueAmount)}</strong></span>
                </div>
                <div className="mt-4">
                  <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                </div>
                <div className="mt-4 grid gap-2">
                  {order.items.map((item) => (
                    <p className="flex justify-between gap-3 rounded-md bg-panel px-3 py-2 text-sm" key={item.id}>
                      <span>{item.name} x {Number(item.quantity)}</span>
                      <strong>{formatAmount(item.lineTotal)}</strong>
                    </p>
                  ))}
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-4">
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-mint/30 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint" disabled={saving || order.status === "COMPLETED"} onClick={() => updateOrder(order, { status: "COMPLETED" })} type="button">
                    <CheckCircle2 size={16} />
                    Mark Delivered
                  </button>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" disabled={saving || !dueAmount} onClick={() => startPartial(order)} type="button">
                    <CreditCard size={16} />
                    Partial Payment
                  </button>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" disabled={saving || !dueAmount} onClick={() => startPartial(order, "Advance")} type="button">
                    <CreditCard size={16} />
                    Advance
                  </button>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" disabled={saving || !dueAmount} onClick={() => updateOrder(order, { paymentStatus: "PAID", paymentMethod: "Cash" })} type="button">
                    <CreditCard size={16} />
                    Full Payment
                  </button>
                </div>
              </article>
              );
            })}
            {!loading && !orders.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No orders yet.</p> : null}
          </div>
        </section>
      </div>

      <Modal open={Boolean(partialOrder)} title="Record partial payment" description="Add payment amount and type for this order." onClose={() => setPartialOrder(null)}>
        {partialOrder ? (
          <form className="grid gap-4" onSubmit={recordPartial}>
            <label className="grid gap-1 text-sm font-semibold">Amount<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" max={due(partialOrder)} min="1" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} required type="number" value={paymentForm.amount} /></label>
            <label className="grid gap-1 text-sm font-semibold">Payment type<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))} value={paymentForm.method}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Reference<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} value={paymentForm.reference} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setPartialOrder(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Payment"}</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </AppShell>
  );
}
