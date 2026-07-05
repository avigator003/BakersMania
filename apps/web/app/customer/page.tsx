"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";
import { AppShell } from "../../components/shell";
import { LoadingSpinner } from "../../components/loading-spinner";
import { useToast } from "../../components/toast-provider";
import { apiFetch, authFetch, getStoredTenantSlug } from "../../lib/api";

type Product = { id: string; name: string; category: string; unitPrice: string | number; active: boolean };
type CartItem = { id: string; name: string; unitPrice: string | number; quantity: number };

const today = new Date().toISOString().slice(0, 10);

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function CustomerPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [dueAt, setDueAt] = useState(today);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadProducts() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ products: Product[] }>(`${apiBase}/catalog/products`);
      setProducts(data.products.filter((product) => product.active !== false));
    } catch (error) {
      toast.error("Could not load products", error instanceof Error ? error.message : "Please check the bakery catalog.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const totals = useMemo(() => ({
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
          dueAt,
          notes: notes || undefined,
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity }))
        })
      });
      toast.success("Order placed", "Your order is now visible to the bakery team.");
      setCart([]);
      setNotes("");
    } catch (error) {
      toast.error("Order failed", error instanceof Error ? error.message : "Could not place this order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Customer Portal" subtitle="Place orders and track bakery updates" surface="customer">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex items-center justify-between gap-3 border-b border-line p-4">
            <div>
              <h1 className="text-xl font-semibold">Products</h1>
              <p className="mt-1 text-sm text-muted">Add products to today&apos;s portal order.</p>
            </div>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadProducts} title="Refresh products" type="button"><RefreshCw size={16} /></button>
          </div>
          {loading ? <LoadingSpinner label="Loading products" /> : null}
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <article className="rounded-lg border border-line bg-panel2 p-4" key={product.id}>
                <p className="text-sm text-mint">{product.category}</p>
                <h2 className="mt-1 min-h-12 font-semibold">{product.name}</h2>
                <p className="mt-3 text-xl font-bold">{formatAmount(product.unitPrice)}</p>
                <button className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-mint px-4 py-3 font-semibold text-white" onClick={() => addProduct(product)} type="button">
                  <Plus size={18} />
                  Add
                </button>
              </article>
            ))}
            {!loading && !products.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-sm text-muted">No active products found.</p> : null}
          </div>
        </section>

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
            <span>Items: <strong className="text-ink">{totals.items}</strong></span>
            <span>Qty: <strong className="text-ink">{totals.quantity}</strong></span>
            <span>Total: <strong className="text-ink">{formatAmount(totals.amount)}</strong></span>
          </div>
          <label className="mt-4 grid gap-1 text-sm font-semibold">Delivery date<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setDueAt(event.target.value)} type="date" value={dueAt} /></label>
          <label className="mt-3 grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setNotes(event.target.value)} value={notes} /></label>
          <button className="focus-ring mt-4 w-full rounded-md bg-mint px-4 py-3 font-semibold text-white" disabled={saving || !cart.length} type="submit">{saving ? "Placing..." : "Place Order"}</button>
        </form>
      </div>
    </AppShell>
  );
}
