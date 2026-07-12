"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaymentHistory } from "../../../components/payment-history";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Product = {
  id: string;
  name: string;
  category: string;
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
  unitPrice: string | number;
  active: boolean;
};
type Category = { id: string; name: string; active?: boolean };
type Payment = { id: string; amount: string | number; method?: string | null; reference?: string | null; paidAt?: string | null };
type OrderItem = {
  id: string;
  productId: string;
  name: string;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
  product?: { id: string; category?: string | null; categoryId?: string | null; categoryRef?: { id: string; name: string } | null } | null;
};
type Order = {
  id: string;
  source: string;
  status: string;
  paymentStatus: string;
  fulfillmentType: string;
  grandTotal: string | number;
  dueAt?: string | null;
  notes?: string | null;
  createdAt: string;
  items: OrderItem[];
  payments?: Payment[];
};
type OrderFormState = {
  dueAt: string;
  notes: string;
  items: { id: string; productId: string; quantity: string }[];
};
type DaySummary = {
  previousDue: number;
  todayOrderAmount: number;
  todayPaid: number;
  todaysDue: number;
  totalDue: number;
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
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function paid(order: Order) {
  return (order.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function due(order: Order) {
  return Math.max(Number(order.grandTotal || 0) - paid(order), 0);
}

function totalAmount(previousDue: number, orderAmount: string | number) {
  return Number(previousDue || 0) + Number(orderAmount || 0);
}

function todaysDueAmount(previousDue: number, orderAmount: string | number, paidAmount: string | number) {
  return Math.max(totalAmount(previousDue, orderAmount) - Number(paidAmount || 0), 0);
}

function productCategory(product: Product) {
  return product.categoryRef?.name || product.category || "General";
}

function itemCategory(item: OrderItem) {
  return item.product?.categoryRef?.name || item.product?.category || "General";
}

function itemCategoryId(item: OrderItem) {
  return item.product?.categoryRef?.id || item.product?.categoryId || "";
}

export default function CustomerOrdersPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [date, setDate] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<OrderFormState>(emptyOrderForm);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.active !== false).map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const productOptions = useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name, description: `${productCategory(product)} · ${formatAmount(product.unitPrice)}` })),
    [products]
  );

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const [productData, categoryData, orderData, summaryData] = await Promise.all([
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=500`),
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`),
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?startDate=${date}&endDate=${date}&pageSize=100`),
        authFetch<{ summary: DaySummary }>(`${apiBase}/orders/customer-day-summary?date=${date}`)
      ]);
      setProducts(productData.products.filter((product) => product.active !== false));
      setCategories(categoryData.categories);
      setOrders(orderData.orders);
      setSummary(summaryData.summary);
    } catch (error) {
      toast.error("Could not load orders", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  const rows = useMemo(() => orders.flatMap((order) => order.items.map((item) => ({
    order,
    item,
    category: itemCategory(item),
    categoryId: itemCategoryId(item),
    paidAmount: paid(order),
    dueAmount: due(order)
  }))).filter((row) => {
    if (categoryFilter && row.categoryId !== categoryFilter) return false;
    if (productFilter && row.item.product?.id !== productFilter) return false;
    return true;
  }), [categoryFilter, orders, productFilter]);

  const totals = useMemo(() => {
    const uniqueOrders = Array.from(new Map(rows.map((row) => [row.order.id, row.order])).values());
    const previousDue = summary?.previousDue || 0;
    const orderAmount = rows.reduce((sum, row) => sum + Number(row.item.lineTotal || 0), 0);
    const paidAmount = uniqueOrders.reduce((sum, order) => sum + paid(order), 0);
    const total = totalAmount(previousDue, orderAmount);
    return {
      products: rows.length,
      quantity: rows.reduce((sum, row) => sum + Number(row.item.quantity || 0), 0),
      previousDue,
      orderAmount,
      paid: paidAmount,
      totalAmount: total,
      todaysDue: Math.max(total - paidAmount, 0)
    };
  }, [rows, summary]);

  function openEditOrder(order: Order) {
    setEditOrder(order);
    setEditForm({
      dueAt: (order.dueAt || order.createdAt).slice(0, 10),
      notes: order.notes || "",
      items: order.items.map((item) => ({ id: item.id, productId: item.productId || item.product?.id || "", quantity: String(item.quantity) }))
    });
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

  async function updateOrder(event: FormEvent<HTMLFormElement>) {
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
      await authFetch(`${apiBase}/orders/${editOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          source: editOrder.source,
          fulfillmentType: editOrder.fulfillmentType,
          dueAt: editForm.dueAt,
          notes: editForm.notes || undefined,
          items
        })
      });
      toast.success("Order updated", "Pending order quantities were recalculated.");
      setEditOrder(null);
      await loadData();
    } catch (error) {
      toast.error("Order update failed", error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setSaving(false);
    }
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
      toast.success("Payment saved", "Your payment was updated for this order.");
      setPaymentOrder(null);
      setPaymentForm({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Payment failed", error instanceof Error ? error.message : "Could not save this payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Customer Portal" subtitle="Orders, dues, and payments" surface="customer">
      <section className="rounded-lg border border-line bg-panel shadow-subtle">
        <div className="border-b border-line p-4">
          <div className="grid gap-3 md:grid-cols-[150px_minmax(180px,1fr)_minmax(180px,1fr)_40px] md:items-end">
            <label className="grid gap-1 text-sm font-semibold">Date<DateInput className="h-10 rounded-md border border-line bg-panel2 px-3 outline-none focus:border-mint" onChange={setDate} value={date} /></label>
            <SearchableSelect className="min-w-0" onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={categoryFilter} />
            <SearchableSelect className="min-w-0" onChange={setProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={productFilter} />
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
          </div>
        </div>
        {loading ? <LoadingSpinner label="Loading orders" /> : null}
        <div className="grid gap-2 border-b border-line p-4 text-sm sm:grid-cols-3 lg:grid-cols-7">
          <span className="rounded-md bg-panel2 p-3">Products<br /><strong>{totals.products}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Quantity<br /><strong>{formatQty(totals.quantity)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Previous Due Amount<br /><strong>{formatAmount(totals.previousDue)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Order Amount<br /><strong>{formatAmount(totals.orderAmount)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Total Amount<br /><strong>{formatAmount(totals.totalAmount)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Paid Amount<br /><strong>{formatAmount(totals.paid)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Today&apos;s Due Amount<br /><strong>{formatAmount(totals.todaysDue)}</strong></span>
        </div>
        <div className="max-h-[calc(100vh-360px)] w-full max-w-full overflow-auto">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Previous Due Amount</th>
                <th className="px-4 py-3 text-right">Order Amount</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Paid Amount</th>
                <th className="px-4 py-3 text-right">Today&apos;s Due Amount</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={`${row.order.id}-${row.item.id}`}>
                  <td className="px-4 py-3 font-semibold">{row.item.name}</td>
                  <td className="px-4 py-3 text-muted">{row.category}</td>
                  <td className="px-4 py-3 text-right">{formatQty(row.item.quantity)}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(totals.previousDue)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(row.item.lineTotal)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(totalAmount(totals.previousDue, row.item.lineTotal))}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(row.paidAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(todaysDueAmount(totals.previousDue, row.item.lineTotal, row.paidAmount))}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <PaymentHistory compact payments={row.order.payments} total={row.order.grandTotal} />
                      <button
                        className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        disabled={saving || row.order.status !== "PENDING"}
                        onClick={() => openEditOrder(row.order)}
                        title={row.order.status === "PENDING" ? "Edit order" : `Cannot edit ${row.order.status.toLowerCase()} order`}
                        type="button"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        className="focus-ring rounded-md bg-mint px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        disabled={saving || (todaysDueAmount(totals.previousDue, row.order.grandTotal, paid(row.order)) <= 0 && !row.order.payments?.length)}
                        onClick={() => startPayment(row.order)}
                        type="button"
                      >
                        {row.order.payments?.length ? "Edit payment" : "Record payment"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !rows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={9}>No products found for this date/filter.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={Boolean(editOrder)} title="Edit pending order" description="Pending orders can be changed until the bakery or vehicle accepts them." onClose={() => setEditOrder(null)}>
        {editOrder ? (
          <form className="grid gap-4" onSubmit={updateOrder}>
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
