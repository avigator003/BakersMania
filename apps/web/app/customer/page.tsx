"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { AppShell } from "../../components/shell";
import { DateInput, localDateInput } from "../../components/date-input";
import { LoadingSpinner } from "../../components/loading-spinner";
import { SearchableSelect } from "../../components/searchable-select";
import { useToast } from "../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../lib/api";

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

const today = localDateInput();

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatQty(value?: string | number | null) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function productCategory(product: Product) {
  return product.categoryRef?.name || product.category || "General";
}

export default function CustomerPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [date, setDate] = useState(today);
  const [shopCategoryFilter, setShopCategoryFilter] = useState("");
  const [shopProductFilter, setShopProductFilter] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const [productData, categoryData] = await Promise.all([
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=500`),
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`)
      ]);
      setProducts(productData.products.filter((product) => product.active !== false));
      setCategories(categoryData.categories);
    } catch (error) {
      toast.error("Could not load shop", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const shopProducts = useMemo(() => products.filter((product) => {
    if (shopCategoryFilter && product.categoryId !== shopCategoryFilter && product.categoryRef?.id !== shopCategoryFilter) return false;
    if (shopProductFilter && product.id !== shopProductFilter) return false;
    return true;
  }), [products, shopCategoryFilter, shopProductFilter]);

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
    } catch (error) {
      toast.error("Order failed", error instanceof Error ? error.message : "Could not place this order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Customer Portal" subtitle="Shop and create orders" surface="customer">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[minmax(180px,260px)_minmax(220px,1fr)] md:items-end">
            <SearchableSelect className="min-w-0" onChange={setShopCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={shopCategoryFilter} />
            <SearchableSelect className="min-w-0" onChange={setShopProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={shopProductFilter} />
          </div>
          {loading ? <LoadingSpinner label="Loading shop" /> : null}
          <div className="grid min-h-[220px] gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-3">
            {shopProducts.map((product) => (
              <article className="rounded-lg border border-line bg-panel2 p-4" key={product.id}>
                <p className="text-sm text-mint">{productCategory(product)}</p>
                <h2 className="mt-1 min-h-12 font-semibold">{product.name}</h2>
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

        <form className="rounded-lg border border-line bg-panel p-4 shadow-subtle xl:sticky xl:top-24 xl:self-start" onSubmit={placeOrder}>
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
    </AppShell>
  );
}
