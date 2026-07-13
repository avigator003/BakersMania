"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, addLocalDays, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaymentHistory, paymentDue, paymentTotal } from "../../../components/payment-history";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Product = {
  id: string;
  name: string;
  category?: string | null;
  categoryRef?: { name: string } | null;
  unitPrice: string | number;
  active: boolean;
};
type Payment = { id: string; amount: string | number; method?: string | null; reference?: string | null; paidAt?: string | null };
type Order = {
  id: string;
  source: string;
  status: string;
  vehicleStatus?: string;
  paymentStatus: string;
  fulfillmentType: string;
  grandTotal: string | number;
  dueAt?: string | null;
  notes?: string | null;
  createdAt: string;
  customer: { id?: string; name: string; phone?: string | null; route?: { name: string } | null };
  route?: { name: string } | null;
  items: {
    id: string;
    productId: string;
    name: string;
    quantity: string | number;
    unitPrice?: string | number | null;
    lineTotal?: string | number | null;
    product?: { category?: string | null; categoryRef?: { name: string } | null } | null;
  }[];
  payments?: Payment[];
};
type OrderFormState = {
  dueAt: string;
  notes: string;
  items: { id: string; productId: string; quantity: string }[];
};

const paymentMethods = ["Cash", "UPI"];
const paymentTypes = [
  { value: "PARTIAL", label: "Partial" },
  { value: "ORDER_FULL", label: "Order Full Payment" },
  { value: "DUE_FULL", label: "Due Full Payment" }
];

const today = localDateInput();
const emptyOrderForm: OrderFormState = { dueAt: today, notes: "", items: [{ id: "row-1", productId: "", quantity: "" }] };

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

function totalAmount(previousDue: number, orderAmount: string | number) {
  return Number(previousDue || 0) + Number(orderAmount || 0);
}

function todaysDueAmount(previousDue: number, orderAmount: string | number, paidAmount: string | number) {
  return Math.max(totalAmount(previousDue, orderAmount) - Number(paidAmount || 0), 0);
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
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [previousOrders, setPreviousOrders] = useState<Order[]>([]);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<OrderFormState>(emptyOrderForm);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: date, endDate: date });
      const previousEndDate = localDateInput(addLocalDays(new Date(`${date}T00:00:00`), -1));
      const previousParams = new URLSearchParams({ endDate: previousEndDate, pageSize: "500" });
      params.set("_", String(Date.now()));
      previousParams.set("_", String(Date.now()));
      const [productData, data, previousData] = await Promise.all([
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=500&_=${Date.now()}`),
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?${params.toString()}`),
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?${previousParams.toString()}`)
      ]);
      setProducts(productData.products.filter((product) => product.active !== false));
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
    return todaysDueAmount(previousDue(order), order.grandTotal, orderPaid(order));
  }

  const customerOptions = useMemo(() => {
    const customers = new Map<string, { value: string; label: string; description?: string }>();
    orders.forEach((order) => {
      const value = customerKey(order);
      if (!customers.has(value)) {
        customers.set(value, {
          value,
          label: order.customer.name,
          description: [order.customer.phone, order.route?.name || order.customer.route?.name].filter(Boolean).join(" · ") || undefined
        });
      }
    });
    return Array.from(customers.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [orders]);

  const visibleOrders = useMemo(
    () => customerFilter.length ? orders.filter((order) => customerFilter.includes(customerKey(order))) : orders,
    [customerFilter, orders]
  );

  const totals = useMemo(() => ({
    orders: visibleOrders.length,
    orderAmount: visibleOrders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
    previousDue: visibleOrders.reduce((sum, order) => sum + previousDue(order), 0),
    paid: visibleOrders.reduce((sum, order) => sum + orderPaid(order), 0)
  }), [visibleOrders, previousDueByCustomer]);
  const todayDueTotal = Math.max(totals.orderAmount + totals.previousDue - totals.paid, 0);

  function openEditOrder(order: Order) {
    setEditOrder(order);
    setEditForm({
      dueAt: (order.dueAt || order.createdAt).slice(0, 10),
      notes: order.notes || "",
      items: order.items.map((item) => ({ id: item.id, productId: item.productId || "", quantity: String(item.quantity) }))
    });
  }

  function updateFormItem(rowId: string, patch: Partial<{ productId: string; quantity: string }>) {
    setEditForm((current) => ({
      ...current,
      items: current.items.map((item) => item.id === rowId ? { ...item, ...patch } : item)
    }));
  }

  function addFormItem() {
    setEditForm((current) => ({ ...current, items: [...current.items, { id: `row-${Date.now()}`, productId: "", quantity: "" }] }));
  }

  function removeFormItem(rowId: string) {
    setEditForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((item) => item.id !== rowId) }));
  }

  async function updateOrder(order: Order, patch: { status?: string; vehicleStatus?: string; paymentStatus?: string; paymentAmount?: number; paymentMethod?: string; reference?: string }) {
    if (!apiBase) return;
    setSaving(true);
    try {
      if (patch.vehicleStatus) {
        setOrders((current) => current.map((item) => item.id === order.id ? { ...item, vehicleStatus: patch.vehicleStatus } : item));
      }
      const result = await authFetch<{ order: Order }>(`${apiBase}/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify(patch) });
      const updatedOrder = { ...result.order, ...(patch.vehicleStatus ? { vehicleStatus: patch.vehicleStatus } : {}) };
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updatedOrder } : item));
      setPreviousOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updatedOrder } : item));
      toast.success("Order updated", `${order.customer.name} has been updated.`);
      setPaymentOrder(null);
      setPaymentForm({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Update failed", error instanceof Error ? error.message : "Could not update this order.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !editOrder) return;
    const items = editForm.items
      .filter((item) => item.productId && Number(item.quantity) > 0)
      .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }));
    if (!items.length) {
      toast.warning("No products selected", "Add at least one product quantity.");
      return;
    }
    setSaving(true);
    try {
      const result = await authFetch<{ order: Order }>(`${apiBase}/orders/${editOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          source: editOrder.source,
          fulfillmentType: editOrder.fulfillmentType,
          dueAt: editForm.dueAt,
          notes: editForm.notes || undefined,
          items
        })
      });
      setOrders((current) => current.map((item) => item.id === editOrder.id ? { ...item, ...result.order } : item));
      toast.success("Order updated", `${editOrder.customer.name} order was recalculated.`);
      setEditOrder(null);
      await loadData();
    } catch (error) {
      toast.error("Order update failed", error instanceof Error ? error.message : "Could not update this order.");
    } finally {
      setSaving(false);
    }
  }

  function paymentAmountForType(order: Order, type: string) {
    if (type === "ORDER_FULL") return Number(order.grandTotal || 0);
    if (type === "DUE_FULL") return todayDue(order);
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
    if (!apiBase || !paymentOrder?.customer.id) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/customers/${paymentOrder.customer.id}/payments`, {
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
      toast.success("Payment recorded", `${paymentOrder.customer.name} payment was saved.`);
      setPaymentOrder(null);
      setPaymentForm({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Payment failed", error instanceof Error ? error.message : "Could not record this payment.");
    } finally {
      setSaving(false);
    }
  }

  function exportCollectionSheet() {
    const headers = ["Customer", "Phone", "Order Amount", "Previous Due Amount", "Paid Amount", "Today's Due Amount", "Payment Method", "Reference"];
    const rows = visibleOrders.map((order) => [
      order.customer.name,
      order.customer.phone || "",
      Number(order.grandTotal || 0),
      previousDue(order),
      orderPaid(order),
      todayDue(order),
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
              <span>Order Amount: <span className="font-semibold text-ink">{formatAmount(totals.orderAmount)}</span></span>
              <span>Previous Due Amount: <span className="font-semibold text-ink">{formatAmount(totals.previousDue)}</span></span>
              <span>Paid Amount: <span className="font-semibold text-ink">{formatAmount(totals.paid)}</span></span>
              <span>Today&apos;s Due Amount: <span className="font-semibold text-ink">{formatAmount(todayDueTotal)}</span></span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_auto_auto]">
              <SearchableSelect className="min-w-0" multiple onChange={setCustomerFilter} options={customerOptions} placeholder="All customers" searchPlaceholder="Search customers" value={customerFilter} />
              <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={setDate} value={date} />
              <button className="focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-line bg-panel2 px-3 text-sm font-semibold" disabled={!visibleOrders.length} onClick={exportCollectionSheet} type="button"><Download size={16} /> Export</button>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
            </div>
          </div>
          {loading ? <LoadingSpinner label="Loading assigned orders" /> : null}
          <div className="max-h-[700px] w-full max-w-full overflow-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Order Amount</th>
                  <th className="px-4 py-3 text-right">Previous Due Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Today's Due Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleOrders.map((order) => (
                    <tr className="align-top" key={order.id}>
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{order.customer.name}</span>
                        <span className="text-xs text-muted">{order.customer.phone || "No phone"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(order.grandTotal)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(previousDue(order))}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(orderPaid(order))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-berry">{formatAmount(todayDue(order))}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                          <button className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold" onClick={() => setDetailOrder(order)} type="button"><Eye size={14} /> Order details</button>
                          <button className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold" disabled={saving} onClick={() => openEditOrder(order)} type="button"><Pencil size={14} /> Edit</button>
                          <select
                            className={`focus-ring rounded-md border px-3 py-2 text-xs font-semibold outline-none ${order.vehicleStatus === "ACCEPTED" ? "border-mint/30 bg-mint/10 text-mint" : "border-amber-400/40 bg-amber-100 text-amber-700"}`}
                            disabled={saving}
                            onChange={(event) => updateOrder(order, { vehicleStatus: event.target.value })}
                            value={order.vehicleStatus || "PENDING"}
                          >
                            <option value="PENDING">Pending</option>
                            <option value="ACCEPTED">Accepted</option>
                          </select>
                          <button className="focus-ring rounded-md bg-mint px-3 py-2 text-xs font-semibold text-white" disabled={saving || (todayDue(order) <= 0 && !order.payments?.length)} onClick={() => startPayment(order)} type="button">{order.payments?.length ? "Edit payment" : "Record payment"}</button>
                        </div>
                      </td>
                    </tr>
                ))}
                {!loading && !visibleOrders.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-muted" colSpan={6}>No customers for this date.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={Boolean(editOrder)} title="Edit order" description={editOrder ? `${editOrder.customer.name} · Vehicle can edit accepted orders` : ""} onClose={() => setEditOrder(null)}>
        {editOrder ? (
          <form className="grid gap-4" onSubmit={saveOrder}>
            <label className="grid gap-1 text-sm font-semibold">Order date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setEditForm((current) => ({ ...current, dueAt: value }))} value={editForm.dueAt} /></label>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Products</p>
                <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold" onClick={addFormItem} type="button"><Plus size={15} /> Add Product</button>
              </div>
              {editForm.items.map((item) => (
                <div className="grid gap-2 rounded-md border border-line bg-panel2 p-3 sm:grid-cols-[1fr_120px_40px]" key={item.id}>
                  <select className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" onChange={(event) => updateFormItem(item.id, { productId: event.target.value })} required value={item.productId}>
                    <option value="">Select product</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatAmount(product.unitPrice)}</option>)}
                  </select>
                  <input className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" min="0.001" onChange={(event) => updateFormItem(item.id, { quantity: event.target.value })} placeholder="Qty" required step="0.001" type="number" value={item.quantity} />
                  <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel" disabled={editForm.items.length === 1} onClick={() => removeFormItem(item.id)} title="Remove product" type="button"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <label className="grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} value={editForm.notes} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setEditOrder(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Order"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(paymentOrder)} title={paymentOrder?.payments?.length ? "Edit payment" : "Record payment"} description="Save the single payment amount for this order." onClose={() => setPaymentOrder(null)}>
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
            <label className="grid gap-1 text-sm font-semibold">Amount<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" max={paymentForm.type === "PARTIAL" ? totalAmount(previousDue(paymentOrder), paymentOrder.grandTotal) : undefined} min="1" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} readOnly={paymentForm.type !== "PARTIAL"} required type="number" value={paymentForm.amount} /></label>
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
          <>
            <div className="max-h-[560px] overflow-auto rounded-lg border border-line sm:hidden">
              <div className="grid gap-3 p-3">
                {detailOrder.items.map((item) => (
                  <article className="rounded-lg border border-line bg-panel2 p-3" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{item.name}</h3>
                        <p className="mt-1 text-xs text-muted">{itemCategory(item)}</p>
                        <p className="mt-1 text-xs text-muted">Qty {formatQty(item.quantity) || "0"}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">{formatAmount(itemAmount(item))}</span>
                    </div>
                  </article>
                ))}
                <div className="rounded-lg border border-line bg-panel2 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>Total</span>
                    <span>{formatAmount(detailOrder.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden max-h-[560px] overflow-auto rounded-lg border border-line sm:block">
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
          </>
        ) : null}
      </Modal>
    </AppShell>
  );
}
