"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
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
  name: string;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
  product?: { id: string; category?: string | null; categoryId?: string | null; categoryRef?: { id: string; name: string } | null } | null;
};
type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  grandTotal: string | number;
  dueAt?: string | null;
  createdAt: string;
  items: OrderItem[];
  payments?: Payment[];
};
type DaySummary = {
  previousDue: number;
  todayOrderAmount: number;
  todayPaid: number;
  todaysDue: number;
  totalDue: number;
};

const today = localDateInput();
const paymentMethods = ["Cash", "UPI"];

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
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "Cash", reference: "" });
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
    return {
      products: rows.length,
      quantity: rows.reduce((sum, row) => sum + Number(row.item.quantity || 0), 0),
      orderAmount: rows.reduce((sum, row) => sum + Number(row.item.lineTotal || 0), 0),
      paid: uniqueOrders.reduce((sum, order) => sum + paid(order), 0),
      previousDue: summary?.previousDue || 0,
      todaysDue: summary?.todaysDue || uniqueOrders.reduce((sum, order) => sum + due(order), 0),
      totalDue: summary?.totalDue || uniqueOrders.reduce((sum, order) => sum + due(order), 0)
    };
  }, [rows, summary]);

  function openPayment(order: Order) {
    setPaymentOrder(order);
    setPaymentForm({ amount: String(due(order) || ""), method: "Cash", reference: "" });
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !paymentOrder) return;
    setSaving(true);
    try {
      const amount = Number(paymentForm.amount || 0);
      const dueAmount = due(paymentOrder);
      await authFetch(`${apiBase}/orders/${paymentOrder.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentStatus: amount >= dueAmount ? "PAID" : "PARTIAL",
          paymentAmount: amount >= dueAmount ? undefined : amount,
          paymentMethod: paymentForm.method,
          reference: paymentForm.reference || undefined
        })
      });
      toast.success("Payment updated", "The payment status was changed.");
      setPaymentOrder(null);
      await loadData();
    } catch (error) {
      toast.error("Payment failed", error instanceof Error ? error.message : "Could not update payment.");
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
          <span className="rounded-md bg-panel2 p-3">Order Amount<br /><strong>{formatAmount(totals.orderAmount)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Paid<br /><strong>{formatAmount(totals.paid)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Previous Due<br /><strong>{formatAmount(totals.previousDue)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Today&apos;s Due<br /><strong>{formatAmount(totals.todaysDue)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Total Due<br /><strong>{formatAmount(totals.totalDue)}</strong></span>
        </div>
        <div className="max-h-[calc(100vh-360px)] w-full max-w-full overflow-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Order Amount</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Previous Due</th>
                <th className="px-4 py-3 text-right">Today&apos;s Due</th>
                <th className="px-4 py-3">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={`${row.order.id}-${row.item.id}`}>
                  <td className="px-4 py-3 font-semibold">{row.item.name}</td>
                  <td className="px-4 py-3 text-muted">{row.category}</td>
                  <td className="px-4 py-3 text-right">{formatQty(row.item.quantity)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(row.item.lineTotal)}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(row.paidAmount)}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(totals.previousDue)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(row.dueAmount)}</td>
                  <td className="px-4 py-3">
                    <button className="focus-ring rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold disabled:opacity-50" disabled={!row.dueAmount || saving} onClick={() => openPayment(row.order)} type="button">
                      {row.dueAmount ? "Record Payment" : "Paid"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !rows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={8}>No products found for this date/filter.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={Boolean(paymentOrder)} title="Record payment" description={paymentOrder ? `Due ${formatAmount(due(paymentOrder))}` : ""} onClose={() => setPaymentOrder(null)}>
        {paymentOrder ? (
          <form className="grid gap-4" onSubmit={recordPayment}>
            <label className="grid gap-1 text-sm font-semibold">Amount<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" max={due(paymentOrder)} min="1" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} required type="number" value={paymentForm.amount} /></label>
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
