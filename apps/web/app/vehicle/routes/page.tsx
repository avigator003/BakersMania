"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { Modal } from "../../../components/modal";
import { PaymentHistory, paymentDue, paymentTotal } from "../../../components/payment-history";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Payment = { id: string; amount: string | number; method?: string | null; reference?: string | null; paidAt?: string | null };
type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  grandTotal: string | number;
  dueAt?: string | null;
  createdAt: string;
  customer: { name: string; phone?: string | null; route?: { name: string } | null };
  route?: { name: string } | null;
  items: { id: string; name: string; quantity: string | number }[];
  payments?: Payment[];
};

const today = new Date().toISOString().slice(0, 10);
const paymentMethods = ["Cash", "Advance", "UPI", "Bank Transfer", "Cheque"];

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatQty(value?: string | number | null) {
  const amount = Number(value || 0);
  return amount ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount) : "";
}

function orderPaid(order: Order) {
  return paymentTotal(order.payments);
}

function orderDue(order: Order) {
  return paymentDue(order.grandTotal, order.payments);
}

function routeName(order: Order) {
  return order.route?.name || order.customer.route?.name || "No route";
}

function statusClass(status: string) {
  if (status === "COMPLETED") return "border-mint/30 bg-mint/10 text-mint";
  if (status === "DISPATCHED") return "border-sky-400/40 bg-sky-100 text-sky-700";
  return "border-amber-400/40 bg-amber-100 text-amber-700";
}

export default function VehicleRoutesPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partialOrder, setPartialOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "Cash", reference: "" });
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: date, endDate: date });
      const data = await authFetch<{ orders: Order[] }>(`${apiBase}/orders?${params.toString()}`);
      setOrders(data.orders);
    } catch (error) {
      toast.error("Could not load assigned routes", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  const totals = useMemo(() => ({
    orders: orders.length,
    delivered: orders.filter((order) => order.status === "COMPLETED").length,
    due: orders.reduce((sum, order) => sum + orderDue(order), 0),
    paid: orders.reduce((sum, order) => sum + orderPaid(order), 0)
  }), [orders]);

  async function updateOrder(order: Order, patch: { status?: string; paymentStatus?: string; paymentAmount?: number; paymentMethod?: string; reference?: string }) {
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify(patch) });
      toast.success("Order updated", `${order.customer.name} has been updated.`);
      setPartialOrder(null);
      setPaymentForm({ amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Update failed", error instanceof Error ? error.message : "Could not update this order.");
    } finally {
      setSaving(false);
    }
  }

  function startPartial(order: Order, method = "Cash") {
    setPartialOrder(order);
    setPaymentForm({ amount: String(orderDue(order) || ""), method, reference: "" });
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
    <AppShell title="Vehicle Workspace" subtitle="Assigned route deliveries and collections" surface="vehicle">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Assigned Routes</h1>
              <p className="mt-1 text-sm text-muted">Only route orders assigned to this vehicle are visible.</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              <span>Orders: <span className="font-semibold text-ink">{totals.orders}</span></span>
              <span>Delivered: <span className="font-semibold text-ink">{totals.delivered}</span></span>
              <span>Collected: <span className="font-semibold text-ink">{formatAmount(totals.paid)}</span></span>
              <span>Due: <span className="font-semibold text-ink">{formatAmount(totals.due)}</span></span>
            </div>
            <div className="flex gap-2">
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
            </div>
          </div>
          {loading ? <p className="p-4 text-sm text-muted">Loading assigned orders...</p> : null}
          <div className="grid gap-3 p-3">
            {orders.map((order) => {
              const due = orderDue(order);
              return (
                <article className="rounded-lg border border-line bg-panel2 p-4" key={order.id}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{order.customer.name}</h2>
                      <p className="mt-1 text-sm text-muted">{routeName(order)} · {order.customer.phone || "No phone"}</p>
                      <p className="mt-2 text-sm">{order.items.map((item) => `${item.name} ${formatQty(item.quantity)}`).join(", ")}</p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[360px]">
                      <span className="rounded-md bg-panel px-3 py-2">Order: <strong>{formatAmount(order.grandTotal)}</strong></span>
                      <span className="rounded-md bg-panel px-3 py-2">Paid: <strong>{formatAmount(orderPaid(order))}</strong></span>
                      <span className="rounded-md bg-panel px-3 py-2">Due: <strong className="text-berry">{formatAmount(due)}</strong></span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                    <button className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${statusClass("DISPATCHED")}`} disabled={saving} onClick={() => updateOrder(order, { status: "DISPATCHED" })} type="button">Truck Loading</button>
                    <button className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${statusClass("COMPLETED")}`} disabled={saving} onClick={() => updateOrder(order, { status: "COMPLETED" })} type="button">Delivered</button>
                    <button className="focus-ring rounded-md border border-berry/30 bg-berry/10 px-3 py-2 text-sm font-semibold text-berry" disabled={saving} onClick={() => updateOrder(order, { status: "DISPATCHED" })} type="button">Not Delivered</button>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <button className="focus-ring rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" disabled={saving || !due} onClick={() => startPartial(order)} type="button">Partial</button>
                      <button className="focus-ring rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" disabled={saving || !due} onClick={() => updateOrder(order, { paymentStatus: "PAID", paymentMethod: "Cash" })} type="button">Full</button>
                      <button className="focus-ring rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold" disabled={saving || !due} onClick={() => startPartial(order, "Advance")} type="button">Advance</button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted">Status: <span className="font-semibold">{order.status}</span> · Payment: <span className="font-semibold">{order.paymentStatus}</span></p>
                  <div className="mt-3">
                    <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                  </div>
                </article>
              );
            })}
            {!loading && !orders.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No assigned orders for this date.</p> : null}
          </div>
        </section>
      </div>

      <Modal open={Boolean(partialOrder)} title="Record partial payment" description="Save amount and payment type for this route order." onClose={() => setPartialOrder(null)}>
        {partialOrder ? (
          <form className="grid gap-4" onSubmit={recordPartial}>
            <label className="grid gap-1 text-sm font-semibold">Amount<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" max={orderDue(partialOrder)} min="1" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} required type="number" value={paymentForm.amount} /></label>
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
