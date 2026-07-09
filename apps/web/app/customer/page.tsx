"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";
import { AppShell } from "../../components/shell";
import { DateInput, localDateInput } from "../../components/date-input";
import { LoadingSpinner } from "../../components/loading-spinner";
import { Modal } from "../../components/modal";
import { SearchableSelect } from "../../components/searchable-select";
import { useToast } from "../../components/toast-provider";
import { apiFetch, authFetch, getStoredTenantSlug } from "../../lib/api";

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
type CartItem = { id: string; name: string; unitPrice: string | number; quantity: number };
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

export default function CustomerPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [date, setDate] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [shopCategoryFilter, setShopCategoryFilter] = useState("");
  const [shopSearch, setShopSearch] = useState("");
  const [notes, setNotes] = useState("");
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
        apiFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=500`),
        apiFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`),
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?startDate=${date}&endDate=${date}&pageSize=100`),
        authFetch<{ summary: DaySummary }>(`${apiBase}/orders/customer-day-summary?date=${date}`)
      ]);
      setProducts(productData.products.filter((product) => product.active !== false));
      setCategories(categoryData.categories);
      setOrders(orderData.orders);
      setSummary(summaryData.summary);
    } catch (error) {
      toast.error("Could not load customer dashboard", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  const filteredProducts = useMemo(() => products.filter((product) => {
    if (categoryFilter && product.categoryId !== categoryFilter && product.categoryRef?.id !== categoryFilter) return false;
    if (productFilter && product.id !== productFilter) return false;
    return true;
  }), [categoryFilter, productFilter, products]);

  const shopProducts = useMemo(() => products.filter((product) => {
    const query = shopSearch.trim().toLowerCase();
    if (shopCategoryFilter && product.categoryId !== shopCategoryFilter && product.categoryRef?.id !== shopCategoryFilter) return false;
    if (query && ![product.name, productCategory(product)].some((value) => value.toLowerCase().includes(query))) return false;
    return true;
  }), [products, shopCategoryFilter, shopSearch]);

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

  const cartTotals = useMemo(() => ({
    items: cart.length,
    quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
    amount: cart.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0)
  }), [cart]);

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { id: product.id, name: product.name, unitPrice: product.unitPrice, quantity: 1 }];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((current) => current.map((item) => item.id === productId ? { ...item, quantity } : item).filter((item) => item.quantity > 0));
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !cart.length) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders`, {
        method: "POST",
        body: JSON.stringify({
          source: "CUSTOMER_PORTAL",
          fulfillmentType: "DELIVERY",
          dueAt: date,
          notes: notes || undefined,
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity }))
        })
      });
      toast.success("Order placed", "Your order is now visible to the bakery team.");
      setCart([]);
      setNotes("");
      await loadData();
    } catch (error) {
      toast.error("Order failed", error instanceof Error ? error.message : "Could not place this order.");
    } finally {
      setSaving(false);
    }
  }

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
    <AppShell title="Customer Portal" subtitle="Daily products, dues, and payments" surface="customer">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Daily Product Table</h1>
              <p className="mt-1 text-sm text-muted">Filter today&apos;s products, dues, and payment changes.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[150px_1fr_1fr_40px] lg:min-w-[760px]">
              <label className="grid gap-1 text-sm font-semibold">Date<DateInput className="h-10 rounded-md border border-line bg-panel2 px-3 outline-none focus:border-mint" onChange={setDate} value={date} /></label>
              <SearchableSelect onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={categoryFilter} />
              <SearchableSelect onChange={setProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={productFilter} />
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2 sm:self-end" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
            </div>
          </div>
          {loading ? <LoadingSpinner label="Loading dashboard" /> : null}
          <div className="grid gap-2 border-b border-line p-4 text-sm sm:grid-cols-3 lg:grid-cols-7">
            <span className="rounded-md bg-panel2 p-3">Products<br /><strong>{totals.products}</strong></span>
            <span className="rounded-md bg-panel2 p-3">Quantity<br /><strong>{formatQty(totals.quantity)}</strong></span>
            <span className="rounded-md bg-panel2 p-3">Order Amount<br /><strong>{formatAmount(totals.orderAmount)}</strong></span>
            <span className="rounded-md bg-panel2 p-3">Paid<br /><strong>{formatAmount(totals.paid)}</strong></span>
            <span className="rounded-md bg-panel2 p-3">Previous Due<br /><strong>{formatAmount(totals.previousDue)}</strong></span>
            <span className="rounded-md bg-panel2 p-3">Today&apos;s Due<br /><strong>{formatAmount(totals.todaysDue)}</strong></span>
            <span className="rounded-md bg-panel2 p-3">Total Due<br /><strong>{formatAmount(totals.totalDue)}</strong></span>
          </div>
          <div className="max-h-[620px] w-full max-w-full overflow-auto">
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

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-line bg-panel shadow-subtle">
            <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1fr_220px_280px] lg:items-end">
              <div>
                <h2 className="text-lg font-semibold">Shop</h2>
                <p className="mt-1 text-sm text-muted">Search products and add them to your order.</p>
              </div>
              <SearchableSelect onChange={setShopCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={shopCategoryFilter} />
              <label className="grid gap-1 text-sm font-semibold">
                Search
                <input
                  className="h-10 rounded-md border border-line bg-panel2 px-3 outline-none focus:border-mint"
                  onChange={(event) => setShopSearch(event.target.value)}
                  placeholder="Search products"
                  value={shopSearch}
                />
              </label>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {shopProducts.map((product) => (
                <article className="rounded-lg border border-line bg-panel2 p-4" key={product.id}>
                  <p className="text-sm text-mint">{productCategory(product)}</p>
                  <h3 className="mt-1 min-h-12 font-semibold">{product.name}</h3>
                  <p className="mt-3 text-xl font-bold">{formatAmount(product.unitPrice)}</p>
                  <button className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-mint px-4 py-3 font-semibold text-white" onClick={() => addProduct(product)} type="button">
                    <Plus size={18} />
                    Add
                  </button>
                </article>
              ))}
              {!loading && !shopProducts.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-sm text-muted">No active products found.</p> : null}
            </div>
          </div>

          <form className="rounded-lg border border-line bg-panel p-4 shadow-subtle" onSubmit={placeOrder}>
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-mint" size={20} />
              <h2 className="text-lg font-semibold">Order Cart</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {cart.map((item) => (
                <div className="grid grid-cols-[1fr_84px_40px] items-center gap-2 rounded-md border border-line bg-panel2 p-3" key={item.id}>
                  <span>
                    <span className="block font-semibold">{item.name}</span>
                    <span className="text-xs text-muted">{formatAmount(item.unitPrice)}</span>
                  </span>
                  <input className="rounded-md border border-line bg-panel px-2 py-2 text-sm outline-none focus:border-mint" min="0.001" onChange={(event) => updateQuantity(item.id, Number(event.target.value))} step="0.001" type="number" value={item.quantity} />
                  <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel" onClick={() => updateQuantity(item.id, 0)} title="Remove item" type="button"><Trash2 size={15} /></button>
                </div>
              ))}
              {!cart.length ? <p className="rounded-md border border-line bg-panel2 p-3 text-sm text-muted">No products selected.</p> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              <span>Items: <strong className="text-ink">{cartTotals.items}</strong></span>
              <span>Qty: <strong className="text-ink">{formatQty(cartTotals.quantity)}</strong></span>
              <span>Total: <strong className="text-ink">{formatAmount(cartTotals.amount)}</strong></span>
            </div>
            <label className="mt-4 grid gap-1 text-sm font-semibold">Order date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={setDate} value={date} /></label>
            <label className="mt-3 grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setNotes(event.target.value)} value={notes} /></label>
            <button className="focus-ring mt-4 w-full rounded-md bg-mint px-4 py-3 font-semibold text-white" disabled={saving || !cart.length} type="submit">{saving ? "Placing..." : "Place Order"}</button>
          </form>
        </section>
      </div>

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
