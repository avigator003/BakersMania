"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Star } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";
import { fetchAllProducts } from "../../../lib/catalog";

type Product = {
  id: string;
  name: string;
  category?: string | null;
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
  active: boolean;
};
type Category = { id: string; name: string; active?: boolean };
type Vehicle = { id: string; preferredProductIds?: string[] };

function productCategory(product: Product) {
  return product.categoryRef?.name || product.category || "General";
}

export default function VehiclePreferredProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [preferredProductIds, setPreferredProductIds] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProductId, setSavingProductId] = useState("");
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const preferredSet = useMemo(() => new Set(preferredProductIds), [preferredProductIds]);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => productCategory(a).localeCompare(productCategory(b)) || a.name.localeCompare(b.name)),
    [products]
  );

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.active !== false).map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const productOptions = useMemo(
    () => sortedProducts.map((product) => ({ value: product.id, label: product.name, description: productCategory(product) })),
    [sortedProducts]
  );

  const visibleProducts = useMemo(() => sortedProducts.filter((product) => {
    if (categoryFilter && product.categoryId !== categoryFilter && product.categoryRef?.id !== categoryFilter) return false;
    if (productFilter && product.id !== productFilter) return false;
    return true;
  }), [categoryFilter, productFilter, sortedProducts]);

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const [productData, categoryData, vehicleData] = await Promise.all([
        fetchAllProducts<Product>(apiBase),
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`),
        authFetch<{ vehicle: Vehicle }>(`${apiBase}/routes/vehicles/me`)
      ]);
      setProducts(productData.filter((product) => product.active !== false));
      setCategories(categoryData.categories);
      setPreferredProductIds(vehicleData.vehicle.preferredProductIds || []);
    } catch (error) {
      toast.error("Could not load products", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function togglePreferred(product: Product) {
    if (!apiBase) return;
    const preferred = !preferredSet.has(product.id);
    const nextPreferredProductIds = preferred
      ? Array.from(new Set([...preferredProductIds, product.id]))
      : preferredProductIds.filter((id) => id !== product.id);
    setPreferredProductIds(nextPreferredProductIds);
    setSavingProductId(product.id);
    try {
      await authFetch(`${apiBase}/routes/vehicles/me/preferred-products`, {
        method: "PATCH",
        body: JSON.stringify({ preferredProductIds: nextPreferredProductIds })
      });
    } catch (error) {
      setPreferredProductIds(preferredProductIds);
      toast.error("Preference failed", error instanceof Error ? error.message : "Could not save preferred products.");
    } finally {
      setSavingProductId("");
    }
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Preferred products" surface="vehicle">
      <section className="rounded-lg border border-line bg-panel shadow-subtle">
        <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[minmax(180px,260px)_minmax(220px,1fr)_auto] md:items-end">
          <SearchableSelect className="min-w-0" onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={categoryFilter} />
          <SearchableSelect className="min-w-0" onChange={setProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={productFilter} />
          <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 text-sm font-semibold" onClick={loadData} type="button">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-b border-line p-4 text-sm text-muted">
          <span>Products: <strong className="text-ink">{visibleProducts.length}</strong></span>
          <span>Preferred: <strong className="text-ink">{preferredProductIds.length}</strong></span>
        </div>
        {loading ? <LoadingSpinner label="Loading products" /> : null}
        <div className="grid min-h-[180px] gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleProducts.map((product) => {
            const preferred = preferredSet.has(product.id);
            return (
              <article className={`flex min-h-32 flex-col rounded-md border p-3 ${preferred ? "border-amber-300 bg-amber-50 shadow-subtle" : "border-line bg-panel2"}`} key={product.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-semibold uppercase text-ink">{productCategory(product)}</p>
                  <button
                    className={`focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border disabled:opacity-50 ${preferred ? "border-amber-300 bg-amber-100 text-amber-700" : "border-line bg-panel"}`}
                    disabled={savingProductId === product.id}
                    onClick={() => togglePreferred(product)}
                    title={preferred ? "Remove preference" : "Add as preference"}
                    type="button"
                  >
                    <Star fill={preferred ? "currentColor" : "none"} size={15} />
                  </button>
                </div>
                <h2 className="mt-2 text-sm font-semibold leading-5 text-mint">{product.name}</h2>
                {preferred ? <p className="mt-auto w-max rounded-sm bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-amber-700">Preferred</p> : null}
              </article>
            );
          })}
          {!loading && !visibleProducts.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-sm text-muted">No active products found.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
