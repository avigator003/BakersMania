"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Eye, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
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
  customer: { id?: string; name: string; phone?: string | null; route?: { name: string } | null };
  route?: { name: string } | null;
  items: {
    id: string;
    name: string;
    quantity: string | number;
    unitPrice?: string | number | null;
    lineTotal?: string | number | null;
    product?: { category?: string | null; categoryRef?: { name: string } | null } | null;
  }[];
  payments?: Payment[];
};

const paymentMethods = ["Cash", "UPI"];
const paymentTypes = ["Partial", "Full", "Advance"];

function inputDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const today = inputDate();

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

function customerKey(order: Order) {
  return order.customer.id || order.customer.name;
}

function itemAmount(item: Order["items"][number]) {
  const lineTotal = Number(item.lineTotal ?? 0);
  if (lineTotal) return lineTotal;
  return Number(item.unitPrice || 0) * Number(item.quantity || 0);
}

function itemCategory(item: Order["items"][number]) {
  return item.product?.categoryRef?.name || item.product?.category || "-";
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export default function VehicleRoutesPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [previousOrders, setPreviousOrders] = useState<Order[]>([]);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ type: "Partial", amount: "", method: "Cash", reference: "" });
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: date, endDate: date });
      const previousEndDate = inputDate(addDays(new Date(`${date}T00:00:00`), -1));
      const previousParams = new URLSearchParams({ endDate: previousEndDate, pageSize: "500" });
      const [data, previousData] = await Promise.all([
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?${params.toString()}`),
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?${previousParams.toString()}`)
      ]);
      setOrders(data.orders);
      setPreviousOrders(previousData.orders);
    } catch (error) {
      toast.error("Could not load assigned routes", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  const previousDueByCustomer = useMemo(() => {
    const dueByCustomer = new Map<string, number>();
    previousOrders.forEach((order) => {
      dueByCustomer.set(customerKey(order), (dueByCustomer.get(customerKey(order)) || 0) + orderDue(order));
    });
    return dueByCustomer;
  }, [previousOrders]);

  function previousDue(order: Order) {
    return previousDueByCustomer.get(customerKey(order)) || 0;
  }

  function todayDue(order: Order) {
    return previousDue(order) + orderDue(order);
  }

  const totals = useMemo(() => ({
    orders: orders.length,
    orderAmount: orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
    due: orders.reduce((sum, order) => sum + todayDue(order), 0),
    paid: orders.reduce((sum, order) => sum + orderPaid(order), 0)
  }), [orders, previousDueByCustomer]);

  async function updateOrder(order: Order, patch: { status?: string; paymentStatus?: string; paymentAmount?: number; paymentMethod?: string; reference?: string }) {
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify(patch) });
      toast.success("Order updated", `${order.customer.name} has been updated.`);
      setPaymentOrder(null);
      setPaymentForm({ type: "Partial", amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Update failed", error instanceof Error ? error.message : "Could not update this order.");
    } finally {
      setSaving(false);
    }
  }

  function startPayment(order: Order, type = "Partial") {
    const due = orderDue(order);
    setPaymentOrder(order);
    setPaymentForm({
      type,
      amount: type === "Full" ? String(due || "") : "",
      method: "Cash",
      reference: ""
    });
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentOrder) return;
    await updateOrder(paymentOrder, {
      paymentStatus: paymentForm.type === "Full" ? "PAID" : "PARTIAL",
      paymentAmount: paymentForm.type === "Full" ? undefined : Number(paymentForm.amount),
      paymentMethod: paymentForm.method,
      reference: paymentForm.reference || undefined
    });
  }

  function exportCollectionSheet() {
    const headers = ["Customer", "Phone", "Order Amount", "Previous Due", "Today Due", "Paid Amount", "Payment Method", "Reference"];
    const rows = orders.map((order) => [
      order.customer.name,
      order.customer.phone || "",
      Number(order.grandTotal || 0),
      previousDue(order),
      todayDue(order),
      "",
      "",
      ""
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vehicle-collection-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Assigned customers, deliveries, and collections" surface="vehicle">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Customers</h1>
              <p className="mt-1 text-sm text-muted">Only customers assigned to this vehicle are visible for the selected date.</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              <span>Orders: <span className="font-semibold text-ink">{totals.orders}</span></span>
              <span>Order amount: <span className="font-semibold text-ink">{formatAmount(totals.orderAmount)}</span></span>
              <span>Collected: <span className="font-semibold text-ink">{formatAmount(totals.paid)}</span></span>
              <span>Today due: <span className="font-semibold text-ink">{formatAmount(totals.due)}</span></span>
            </div>
            <div className="flex gap-2">
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
              <button className="focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-line bg-panel2 px-3 text-sm font-semibold" disabled={!orders.length} onClick={exportCollectionSheet} type="button"><Download size={16} /> Export</button>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
            </div>
          </div>
          {loading ? <LoadingSpinner label="Loading assigned orders" /> : null}
          <div className="max-h-[700px] w-full max-w-full overflow-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Order Amount</th>
                  <th className="px-4 py-3 text-right">Previous Due</th>
                  <th className="px-4 py-3 text-right">Today's Due</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => {
                  const due = orderDue(order);
                  return (
                    <tr className="align-top" key={order.id}>
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{order.customer.name}</span>
                        <span className="text-xs text-muted">{order.customer.phone || "No phone"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(order.grandTotal)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(previousDue(order))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-berry">{formatAmount(todayDue(order))}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                          <button className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold" onClick={() => setDetailOrder(order)} type="button"><Eye size={14} /> Order details</button>
                          <button className="focus-ring rounded-md bg-mint px-3 py-2 text-xs font-semibold text-white" disabled={saving || due <= 0} onClick={() => startPayment(order)} type="button">Record payment</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !orders.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-muted" colSpan={5}>No customers for this date.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={Boolean(paymentOrder)} title="Record payment" description="Save payment type, method, reference, and amount." onClose={() => setPaymentOrder(null)}>
        {paymentOrder ? (
          <form className="grid gap-4" onSubmit={recordPayment}>
            <label className="grid gap-1 text-sm font-semibold">Payment type<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => {
              const type = event.target.value;
              setPaymentForm((current) => ({
                ...current,
                type,
                amount: type === "Full" ? String(orderDue(paymentOrder) || "") : "",
                method: current.method
              }));
            }} value={paymentForm.type}>{paymentTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Amount<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" max={orderDue(paymentOrder)} min="1" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} readOnly={paymentForm.type === "Full"} required type="number" value={paymentForm.amount} /></label>
            <label className="grid gap-1 text-sm font-semibold">Payment method<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))} value={paymentForm.method}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Reference<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} value={paymentForm.reference} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setPaymentOrder(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Payment"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(detailOrder)} title="Order details" description={detailOrder ? detailOrder.customer.name : ""} onClose={() => setDetailOrder(null)}>
        {detailOrder ? (
          <div className="max-h-[560px] overflow-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Order Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detailOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold">{item.name}</td>
                    <td className="px-4 py-3 text-muted">{itemCategory(item)}</td>
                    <td className="px-4 py-3 text-right">{formatQty(item.quantity) || "0"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAmount(itemAmount(item))}</td>
                  </tr>
                ))}
                <tr className="bg-panel2 font-semibold">
                  <td className="px-4 py-3" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right">{formatAmount(detailOrder.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
