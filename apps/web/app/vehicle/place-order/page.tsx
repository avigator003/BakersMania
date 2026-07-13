"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, addLocalDays, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Customer = { id: string; name: string; phone?: string | null; route?: { name: string } | null };
type Product = {
  id: string;
  name: string;
  category?: string | null;
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
  unitPrice: string | number;
  active: boolean;
};
type Category = { id: string; name: string; active?: boolean };
type CartItem = { id: string; name: string; unitPrice: string | number; quantity: number };

const tomorrow = localDateInput(addLocalDays(new Date(), 1));

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatQty(value?: string | number | null) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function productCategory(product: Product) {
  return product.categoryRef?.name || product.category || "General";
}

export default function VehiclePlaceOrderPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [date, setDate] = useState(tomorrow);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const customerOptions = useMemo(() => customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
    description: [customer.phone, customer.route?.name].filter(Boolean).join(" · ") || undefined
  })), [customers]);

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.active !== false).map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const productOptions = useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name, description: `${productCategory(product)} · ${formatAmount(product.unitPrice)}` })),
    [products]
  );

  const visibleProducts = useMemo(() => products.filter((product) => {
    if (categoryFilter && product.categoryId !== categoryFilter && product.categoryRef?.id !== categoryFilter) return false;
    if (productFilter && product.id !== productFilter) return false;
    return true;
  }), [categoryFilter, productFilter, products]);

  const orderItems = useMemo(() => cart.filter((item) => item.quantity > 0), [cart]);
  const cartTotals = useMemo(() => ({
    items: orderItems.length,
    quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
    amount: orderItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0)
  }), [orderItems]);

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const [customerData, productData, categoryData] = await Promise.all([
        authFetch<{ customers: Customer[] }>(`${apiBase}/customers?pageSize=500`),
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=500`),
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`)
      ]);
      setCustomers(customerData.customers);
      setProducts(productData.products.filter((product) => product.active !== false));
      setCategories(categoryData.categories);
    } catch (error) {
      toast.error("Could not load order form", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateQuantity(productId: string, quantity: number) {
    setCart((current) => {
      const existing = current.find((item) => item.id === productId);
      if (existing) {
        return current.map((item) => item.id === productId ? { ...item, quantity } : item).filter((item) => item.quantity > 0);
      }
      const product = products.find((item) => item.id === productId);
      if (!product) return current;
      return [...current, { id: product.id, name: product.name, unitPrice: product.unitPrice, quantity }].filter((item) => item.quantity > 0);
    });
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !customerId || !orderItems.length) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders`, {
        method: "POST",
        body: JSON.stringify({
          customerId,
          source: "STAFF_CREATED",
          fulfillmentType: "DELIVERY",
          dueAt: date,
          notes: notes || undefined,
          items: orderItems.map((item) => ({ productId: item.id, quantity: item.quantity }))
        })
      });
      toast.success("Order placed", "Customer order is now visible in vehicle and bakery orders.");
      setCart([]);
      setNotes("");
    } catch (error) {
      toast.error("Order failed", error instanceof Error ? error.message : "Could not place this order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Place customer order" surface="vehicle">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="grid gap-3 border-b border-line p-3 md:grid-cols-[minmax(220px,1fr)_minmax(180px,260px)_minmax(220px,1fr)] md:items-end">
            <SearchableSelect className="min-w-0" onChange={setCustomerId} options={customerOptions} placeholder="Select customer" searchPlaceholder="Search assigned customers" value={customerId} />
            <SearchableSelect className="min-w-0" onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={categoryFilter} />
            <SearchableSelect className="min-w-0" onChange={setProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={productFilter} />
          </div>
          {loading ? <LoadingSpinner label="Loading order form" /> : null}
          <div className="grid min-h-[180px] gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <article className="flex min-h-36 flex-col rounded-md border border-line bg-panel2 p-3" key={product.id}>
                <p className="truncate text-xs font-semibold uppercase text-mint">{productCategory(product)}</p>
                <h2 className="mt-1 text-sm font-semibold leading-5">{product.name}</h2>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <p className="text-lg font-bold">{formatAmount(product.unitPrice)}</p>
                  <input
                    className="w-24 rounded-md border border-line bg-panel px-2 py-1.5 text-sm outline-none focus:border-mint"
                    min="0"
                    onChange={(event) => updateQuantity(product.id, Number(event.target.value))}
                    placeholder="Qty"
                    step="0.001"
                    type="number"
                    value={cart.find((item) => item.id === product.id)?.quantity || ""}
                  />
                </div>
              </article>
            ))}
            {!loading && !visibleProducts.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-sm text-muted">No active products found.</p> : null}
          </div>
        </div>

        <form className="rounded-lg border border-line bg-panel p-3 shadow-subtle xl:sticky xl:top-24 xl:self-start" onSubmit={placeOrder}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-mint" size={18} />
            <h2 className="font-semibold">Customer Order</h2>
          </div>
          <div className="mt-3 grid gap-1.5">
            {orderItems.map((item) => (
              <div className="grid grid-cols-[minmax(0,1fr)_72px_34px] items-center gap-2 rounded-md border border-line bg-panel2 p-2" key={item.id}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{item.name}</span>
                  <span className="text-xs text-muted">{formatAmount(item.unitPrice)}</span>
                </span>
                <input className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm outline-none focus:border-mint" min="0" onChange={(event) => updateQuantity(item.id, Number(event.target.value))} step="0.001" type="number" value={item.quantity} />
                <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel" onClick={() => updateQuantity(item.id, 0)} title="Remove item" type="button"><Trash2 size={14} /></button>
              </div>
            ))}
            {!orderItems.length ? <p className="rounded-md border border-line bg-panel2 p-3 text-sm text-muted">No products selected.</p> : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-muted">
            <span>Items: <strong className="text-ink">{cartTotals.items}</strong></span>
            <span>Qty: <strong className="text-ink">{formatQty(cartTotals.quantity)}</strong></span>
            <span>Total: <strong className="text-ink">{formatAmount(cartTotals.amount)}</strong></span>
          </div>
          <label className="mt-3 grid gap-1 text-sm font-semibold">Order date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={setDate} value={date} /></label>
          <label className="mt-3 grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setNotes(event.target.value)} value={notes} /></label>
          <button className="focus-ring mt-3 w-full rounded-md bg-mint px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={saving || !customerId || !orderItems.length} type="submit">
            {saving ? "Placing..." : "Place Order"}
          </button>
        </form>
      </section>
    </AppShell>
  );
}
