"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, ShoppingCart, Star, Trash2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { AppShell } from "../../components/shell";
import { DateInput, addLocalDays, localDateInput } from "../../components/date-input";
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
  isPreferred?: boolean;
};
type Category = { id: string; name: string; active?: boolean };
type CartItem = { id: string; name: string; unitPrice: string | number; quantity: number };

const tomorrow = localDateInput(addLocalDays(new Date(), 1));
const cartStoragePrefix = "bakersmania_customer_cart";

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
  const pathname = usePathname();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [date, setDate] = useState(tomorrow);
  const [shopCategoryFilter, setShopCategoryFilter] = useState("");
  const [shopProductFilter, setShopProductFilter] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";
  const cartStorageKey = tenantSlug ? `${cartStoragePrefix}_${tenantSlug}` : cartStoragePrefix;

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.active !== false).map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => Number(Boolean(b.isPreferred)) - Number(Boolean(a.isPreferred)) || a.name.localeCompare(b.name)),
    [products]
  );

  const preferredProducts = useMemo(
    () => sortedProducts.filter((product) => product.isPreferred),
    [sortedProducts]
  );

  const preferenceOnly = pathname.endsWith("/customer/cart");
  const visibleProductSource = preferenceOnly ? preferredProducts : sortedProducts;

  const productOptions = useMemo(
    () => visibleProductSource.map((product) => ({ value: product.id, label: product.name, description: `${product.isPreferred ? "Preferred · " : ""}${productCategory(product)} · ${formatAmount(product.unitPrice)}` })),
    [visibleProductSource]
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(cartStorageKey);
      if (saved) setCart(JSON.parse(saved) as CartItem[]);
    } catch {
      setCart([]);
    }
  }, [cartStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const selectedItems = cart.filter((item) => item.quantity > 0);
    if (selectedItems.length) {
      window.localStorage.setItem(cartStorageKey, JSON.stringify(selectedItems));
      return;
    }
    window.localStorage.removeItem(cartStorageKey);
  }, [cart, cartStorageKey]);

  const shopProducts = useMemo(() => visibleProductSource.filter((product) => {
    if (shopCategoryFilter && product.categoryId !== shopCategoryFilter && product.categoryRef?.id !== shopCategoryFilter) return false;
    if (shopProductFilter && product.id !== shopProductFilter) return false;
    return true;
  }), [shopCategoryFilter, shopProductFilter, visibleProductSource]);

  const cartRows = useMemo(
    () => {
      if (!preferenceOnly) return cart;
      const preferredIds = new Set(preferredProducts.map((product) => product.id));
      const preferredRows = preferredProducts.map((product) => {
          const existing = cart.find((item) => item.id === product.id);
          return existing || { id: product.id, name: product.name, unitPrice: product.unitPrice, quantity: 0 };
        });
      const extraRows = cart.filter((item) => !preferredIds.has(item.id) && item.quantity > 0);
      return [...preferredRows, ...extraRows];
    },
    [cart, preferenceOnly, preferredProducts]
  );

  const orderItems = useMemo(() => cartRows.filter((item) => item.quantity > 0), [cartRows]);

  const cartTotals = useMemo(() => ({
    items: orderItems.length,
    quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
    amount: orderItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0)
  }), [orderItems]);

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...current, { id: product.id, name: product.name, unitPrice: product.unitPrice, quantity: 1 }];
    });
    toast.success("Added to cart", `${product.name} is ready in Cart.`);
  }

  function updateQuantity(productId: string, quantity: number) {
    setCart((current) => {
      const existing = current.find((item) => item.id === productId);
      if (existing) {
        const updated = current.map((item) => item.id === productId ? { ...item, quantity } : item);
        return preferenceOnly ? updated : updated.filter((item) => item.quantity > 0);
      }
      const product = products.find((item) => item.id === productId);
      if (!product) return current;
      const next = [...current, { id: product.id, name: product.name, unitPrice: product.unitPrice, quantity }];
      return preferenceOnly ? next : next.filter((item) => item.quantity > 0);
    });
  }

  async function togglePreference(product: Product) {
    if (!apiBase) return;
    const preferred = !product.isPreferred;
    setProducts((current) => current.map((item) => item.id === product.id ? { ...item, isPreferred: preferred } : item));
    try {
      await authFetch(`${apiBase}/catalog/products/${product.id}/preference`, {
        method: "PATCH",
        body: JSON.stringify({ preferred })
      });
    } catch (error) {
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, isPreferred: product.isPreferred } : item));
      toast.error("Preference failed", error instanceof Error ? error.message : "Could not update product preference.");
    }
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !orderItems.length) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders`, {
        method: "POST",
        body: JSON.stringify({
          source: "CUSTOMER_PORTAL",
          fulfillmentType: "DELIVERY",
          dueAt: date,
          notes: notes || undefined,
          items: orderItems.map((item) => ({ productId: item.id, quantity: item.quantity }))
        })
      });
      toast.success("Order placed", "Your order is now visible to the bakery team.");
      setCart([]);
      if (typeof window !== "undefined") window.localStorage.removeItem(cartStorageKey);
      setNotes("");
    } catch (error) {
      toast.error("Order failed", error instanceof Error ? error.message : "Could not place this order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Customer Portal" subtitle="Shop and create orders" surface="customer">
      <section className={`grid gap-4 ${preferenceOnly ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="grid gap-2 border-b border-line p-3 md:grid-cols-[minmax(180px,260px)_minmax(220px,1fr)] md:items-end">
            <SearchableSelect className="min-w-0" onChange={setShopCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={shopCategoryFilter} />
            <SearchableSelect className="min-w-0" onChange={setShopProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={shopProductFilter} />
          </div>
          {loading ? <LoadingSpinner label="Loading shop" /> : null}
          <div className={`grid min-h-[180px] gap-2 p-3 sm:grid-cols-2 ${preferenceOnly ? "2xl:grid-cols-3" : "xl:grid-cols-3 2xl:grid-cols-4"}`}>
            {shopProducts.map((product) => (
              <article className={`flex min-h-40 flex-col rounded-md border p-3 ${product.isPreferred ? "border-amber-300 bg-amber-50 shadow-subtle" : "border-line bg-panel2"}`} key={product.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-semibold uppercase text-mint">{productCategory(product)}</p>
                  <button
                    className={`focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${product.isPreferred ? "border-amber-300 bg-amber-100 text-amber-700" : "border-line bg-panel"}`}
                    onClick={() => togglePreference(product)}
                    title={product.isPreferred ? "Remove preference" : "Add as preference"}
                    type="button"
                  >
                    <Star fill={product.isPreferred ? "currentColor" : "none"} size={15} />
                  </button>
                </div>
                <h2 className="mt-1 text-sm font-semibold leading-5">{product.name}</h2>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {product.isPreferred ? <p className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-amber-700">Preferred</p> : <span />}
                  <p className="text-lg font-bold">{formatAmount(product.unitPrice)}</p>
                </div>
                <button className="focus-ring mt-auto flex w-full items-center justify-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-white" onClick={() => addProduct(product)} type="button">
                  <Plus size={16} />
                  Add
                </button>
              </article>
            ))}
            {!loading && !shopProducts.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-sm text-muted">{preferenceOnly ? "No preferred products found." : "No active products found."}</p> : null}
          </div>
        </div>

        {preferenceOnly ? <form className="rounded-lg border border-line bg-panel p-3 shadow-subtle xl:sticky xl:top-24 xl:self-start" onSubmit={placeOrder}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="text-mint" size={18} />
            <h2 className="font-semibold">Order Cart</h2>
          </div>
          <div className="mt-3 grid gap-1.5">
            {cartRows.map((item) => (
              <div className="grid grid-cols-[minmax(0,1fr)_72px_34px] items-center gap-2 rounded-md border border-line bg-panel2 p-2" key={item.id}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{item.name}</span>
                  <span className="text-xs text-muted">{formatAmount(item.unitPrice)}</span>
                </span>
                <input className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm outline-none focus:border-mint" min="0.001" onChange={(event) => updateQuantity(item.id, Number(event.target.value))} step="0.001" type="number" value={item.quantity} />
                <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel" onClick={() => updateQuantity(item.id, 0)} title="Remove item" type="button"><Trash2 size={14} /></button>
              </div>
            ))}
            {!cartRows.length ? <p className="rounded-md border border-line bg-panel2 p-3 text-sm text-muted">No products selected.</p> : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-muted">
            <span>Items: <strong className="text-ink">{cartTotals.items}</strong></span>
            <span>Qty: <strong className="text-ink">{formatQty(cartTotals.quantity)}</strong></span>
            <span>Total: <strong className="text-ink">{formatAmount(cartTotals.amount)}</strong></span>
          </div>
          <label className="mt-3 grid gap-1 text-sm font-semibold">Order date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={setDate} value={date} /></label>
          <label className="mt-3 grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-16 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setNotes(event.target.value)} value={notes} /></label>
          <button className="focus-ring mt-3 w-full rounded-md bg-mint px-4 py-2.5 font-semibold text-white" disabled={saving || !orderItems.length} type="submit">{saving ? "Placing..." : "Place Order"}</button>
        </form> : null}
      </section>
    </AppShell>
  );
}
