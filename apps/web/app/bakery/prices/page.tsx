"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, IndianRupee, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Route = {
  id: string;
  name: string;
  active: boolean;
  vehicle?: { name: string; number?: string | null; driverName?: string | null } | null;
};

type Product = {
  id: string;
  name: string;
  unitPrice: string | number;
  category?: string | null;
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
};

type Category = {
  id: string;
  name: string;
  active?: boolean;
};

type RouteProductPrice = {
  productId: string;
  price: string | number;
  notes?: string | null;
};

type PriceModalState = {
  route: Route;
  mode: "edit" | "view";
};

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function productCategory(product: Product) {
  return product.categoryRef?.name || product.category || "General";
}

export default function BakeryProductPricesPage() {
  const toast = useToast();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priceModal, setPriceModal] = useState<PriceModalState | null>(null);
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});
  const [existingPriceMap, setExistingPriceMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const categoryOptions = useMemo(
    () => categories
      .filter((category) => category.active !== false)
      .map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    if (!categoryFilter) return products;
    return products.filter((product) => product.categoryId === categoryFilter || product.categoryRef?.id === categoryFilter);
  }, [categoryFilter, products]);

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const [routeData, productData, categoryData] = await Promise.all([
        authFetch<{ routes: Route[] }>(`${apiBase}/routes?pageSize=500`),
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=500`),
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`)
      ]);
      setRoutes(routeData.routes);
      setProducts(productData.products);
      setCategories(categoryData.categories);
    } catch (error) {
      toast.error("Could not load product prices", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function openPrices(route: Route, mode: "edit" | "view") {
    if (!apiBase) return;
    setPriceModal({ route, mode });
    setCategoryFilter("");
    setLoadingPrices(true);
    try {
      const data = await authFetch<{ routePrices: RouteProductPrice[] }>(`${apiBase}/catalog/route-prices?routeId=${encodeURIComponent(route.id)}`);
      const existing = new Map(data.routePrices.map((price) => [price.productId, Number(price.price || 0)]));
      setExistingPriceMap(Object.fromEntries(existing.entries()));
      setPriceMap(Object.fromEntries(products.map((product) => [product.id, String(existing.get(product.id) ?? Number(product.unitPrice || 0))])));
    } catch (error) {
      toast.error("Could not load route prices", error instanceof Error ? error.message : "Please try again.");
      setPriceModal(null);
    } finally {
      setLoadingPrices(false);
    }
  }

  async function savePrices() {
    if (!apiBase || !priceModal) return;
    const changedPrices = products.filter((product) => {
      const nextPrice = Number(priceMap[product.id] || 0);
      const currentPrice = existingPriceMap[product.id] ?? Number(product.unitPrice || 0);
      return Number.isFinite(nextPrice) && nextPrice >= 0 && nextPrice !== currentPrice;
    });

    if (!changedPrices.length) {
      toast.info("No changes", "Prices are already up to date.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(changedPrices.map((product) => authFetch(`${apiBase}/catalog/route-prices`, {
        method: "POST",
        body: JSON.stringify({
          routeId: priceModal.route.id,
          productId: product.id,
          price: Number(priceMap[product.id] || 0),
          notes: "Bakery route product price"
        })
      })));
      toast.success("Route prices updated", `${changedPrices.length} price${changedPrices.length === 1 ? "" : "s"} saved for ${priceModal.route.name}.`);
      setPriceModal(null);
      setPriceMap({});
      setExistingPriceMap({});
    } catch (error) {
      toast.error("Price update failed", error instanceof Error ? error.message : "Could not save route prices.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Route product price settings" surface="bakery">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Product Prices</h1>
              <p className="mt-1 text-sm text-muted">Set route-specific product prices for every customer on that route.</p>
            </div>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
          </div>
          {loading ? <LoadingSpinner label="Loading routes and products" /> : null}
          <div className="grid gap-3 p-3 sm:hidden">
            {routes.map((route) => (
              <article className="rounded-lg border border-line bg-panel2 p-3" key={route.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{route.name}</h2>
                    <p className="mt-1 truncate text-xs text-muted">{route.vehicle?.name || "No vehicle"}</p>
                    <p className="mt-1 truncate text-xs text-muted">{route.vehicle?.driverName || "No driver"}</p>
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${route.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"}`}>
                    {route.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-xs font-semibold" onClick={() => openPrices(route, "view")} type="button"><Eye size={14} /> View</button>
                  <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-3 text-xs font-semibold text-white" onClick={() => openPrices(route, "edit")} type="button"><IndianRupee size={14} /> Assign Price</button>
                </div>
              </article>
            ))}
            {!loading && !routes.length ? (
              <div className="rounded-lg border border-line bg-panel2 px-4 py-8 text-center text-sm text-muted">No routes found.</div>
            ) : null}
          </div>
          <div className="hidden max-h-[700px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {routes.map((route) => (
                  <tr key={route.id}>
                    <td className="px-4 py-3 font-semibold">{route.name}</td>
                    <td className="px-4 py-3">{route.vehicle?.name || "-"}</td>
                    <td className="px-4 py-3 text-muted">{route.vehicle?.driverName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${route.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"}`}>
                        {route.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold" onClick={() => openPrices(route, "view")} type="button"><Eye size={14} /> View</button>
                        <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-xs font-semibold text-white" onClick={() => openPrices(route, "edit")} type="button"><IndianRupee size={14} /> Assign Product Price</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !routes.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-muted" colSpan={5}>No routes found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line p-4 text-sm text-muted">
            Routes: <span className="font-semibold text-ink">{routes.length}</span>
            <span className="px-2">·</span>
            Products: <span className="font-semibold text-ink">{products.length}</span>
          </div>
        </section>
      </div>

      <Modal
        open={Boolean(priceModal)}
        title={priceModal?.mode === "view" ? "View product prices" : "Assign product prices"}
        description={priceModal ? priceModal.route.name : ""}
        onClose={() => setPriceModal(null)}
      >
        {priceModal ? (
          <div className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchableSelect
                className="sm:w-72"
                onChange={setCategoryFilter}
                options={categoryOptions}
                placeholder="All categories"
                searchPlaceholder="Search categories"
                value={categoryFilter}
              />
              {priceModal.mode === "edit" ? (
                <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-4 font-semibold text-white" disabled={saving || loadingPrices} onClick={savePrices} type="button">
                  <IndianRupee size={16} />
                  {saving ? "Updating..." : "Update Prices"}
                </button>
              ) : null}
            </div>
            {loadingPrices ? <LoadingSpinner label="Loading route prices" /> : null}
            <div className="max-h-[62vh] overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Base Price</th>
                    <th className="px-4 py-3 text-right">Route Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-semibold">{product.name}</td>
                      <td className="px-4 py-3 text-muted">{productCategory(product)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(product.unitPrice)}</td>
                      <td className="px-4 py-3 text-right">
                        {priceModal.mode === "view" ? (
                          <span className="font-semibold">{formatAmount(priceMap[product.id] ?? product.unitPrice)}</span>
                        ) : (
                          <input
                            className="ml-auto h-10 w-32 rounded-md border border-line bg-panel2 px-3 text-right font-semibold outline-none focus:border-mint"
                            min="0"
                            onChange={(event) => setPriceMap((current) => ({ ...current, [product.id]: event.target.value }))}
                            type="number"
                            value={priceMap[product.id] ?? String(product.unitPrice)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredProducts.length ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted" colSpan={4}>No products in this category.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
