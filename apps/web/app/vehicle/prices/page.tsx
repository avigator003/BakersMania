"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Eye, IndianRupee, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  routeId?: string | null;
  route?: { id: string; name: string } | null;
  dueBalance?: string | number | null;
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

type CustomerProductPrice = {
  productId: string;
  price: string | number;
  notes?: string | null;
};

type RouteProductPrice = {
  productId: string;
  price: string | number;
};

type PriceModalState = {
  customer: Customer;
  mode: "edit" | "view";
};

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function productCategory(product: Product) {
  return product.categoryRef?.name || product.category || "General";
}

export default function VehiclePricesPage() {
  const toast = useToast();
  const pathname = usePathname();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPriceMap, setBulkPriceMap] = useState<Record<string, string>>({});
  const [priceModal, setPriceModal] = useState<PriceModalState | null>(null);
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});
  const [existingPriceMap, setExistingPriceMap] = useState<Record<string, number>>({});
  const [vehicleBasePriceMap, setVehicleBasePriceMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigningAll, setAssigningAll] = useState(false);
  const pathSegments = pathname.split("/").filter(Boolean);
  const pathTenantSlug = pathSegments.length > 1 && pathSegments[1] === "vehicle" ? pathSegments[0] : "";
  const tenantSlug = pathTenantSlug || (typeof window === "undefined" ? "" : getStoredTenantSlug() || "");
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

  const bulkFilteredProducts = useMemo(() => {
    if (!bulkCategoryFilter) return products;
    return products.filter((product) => product.categoryId === bulkCategoryFilter || product.categoryRef?.id === bulkCategoryFilter);
  }, [bulkCategoryFilter, products]);

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
      setProducts(productData.products);
      setCategories(categoryData.categories);
    } catch (error) {
      toast.error("Could not load pricing data", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function openPrices(customer: Customer, mode: "edit" | "view") {
    if (!apiBase) return;
    setPriceModal({ customer, mode });
    setCategoryFilter("");
    setLoadingPrices(true);
    try {
      const routeId = customer.route?.id || customer.routeId || "";
      const [customerPriceData, routePriceData] = await Promise.all([
        authFetch<{ ledger: { productPrices: CustomerProductPrice[] } }>(`${apiBase}/customers/${customer.id}/ledger`),
        routeId
          ? authFetch<{ routePrices: RouteProductPrice[] }>(`${apiBase}/catalog/route-prices?routeId=${encodeURIComponent(routeId)}`)
          : Promise.resolve({ routePrices: [] })
      ]);
      const existing = new Map(customerPriceData.ledger.productPrices.map((price) => [price.productId, Number(price.price || 0)]));
      const vehicleBase = new Map(routePriceData.routePrices.map((price) => [price.productId, Number(price.price || 0)]));
      setExistingPriceMap(Object.fromEntries(existing.entries()));
      setVehicleBasePriceMap(Object.fromEntries(vehicleBase.entries()));
      setPriceMap(Object.fromEntries(products.map((product) => [product.id, String(existing.get(product.id) ?? vehicleBase.get(product.id) ?? Number(product.unitPrice || 0))])));
    } catch (error) {
      toast.error("Could not load customer prices", error instanceof Error ? error.message : "Please try again.");
      setPriceModal(null);
    } finally {
      setLoadingPrices(false);
    }
  }

  async function savePrices() {
    if (!apiBase || !priceModal) return;
    const changedPrices = products.filter((product) => {
      const nextPrice = Number(priceMap[product.id] || 0);
      const currentPrice = existingPriceMap[product.id] ?? vehicleBasePriceMap[product.id] ?? Number(product.unitPrice || 0);
      return Number.isFinite(nextPrice) && nextPrice >= 0 && nextPrice !== currentPrice;
    });

    if (!changedPrices.length) {
      toast.info("No changes", "Prices are already up to date.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(changedPrices.map((product) => authFetch(`${apiBase}/catalog/customer-prices`, {
        method: "POST",
        body: JSON.stringify({
          customerId: priceModal.customer.id,
          productId: product.id,
          price: Number(priceMap[product.id] || 0),
          notes: "Vehicle dashboard product price"
        })
      })));
      toast.success("Product prices updated", `${changedPrices.length} price${changedPrices.length === 1 ? "" : "s"} saved for ${priceModal.customer.name}.`);
      setPriceModal(null);
      setPriceMap({});
      setExistingPriceMap({});
      setVehicleBasePriceMap({});
    } catch (error) {
      toast.error("Price update failed", error instanceof Error ? error.message : "Could not save customer prices.");
    } finally {
      setSaving(false);
    }
  }

  function openAssignAllProductPrices() {
    setBulkCategoryFilter("");
    setBulkPriceMap(Object.fromEntries(products.map((product) => [product.id, String(product.unitPrice || 0)])));
    setBulkOpen(true);
  }

  async function assignAllUserProductPrices() {
    if (!apiBase) return;
    setAssigningAll(true);
    try {
      const data = await authFetch<{ result: { customers: number; products: number; created: number; updated: number; skipped: number } }>(`${apiBase}/catalog/customer-prices/assign-route-base`, {
        method: "POST",
        body: JSON.stringify({
          overwriteExisting: true,
          prices: products.map((product) => ({
            productId: product.id,
            price: Number(bulkPriceMap[product.id] || 0)
          }))
        })
      });
      setBulkOpen(false);
      setBulkPriceMap({});
      toast.success("Product prices assigned", `${data.result.created + data.result.updated} price${data.result.created + data.result.updated === 1 ? "" : "s"} applied for ${data.result.customers} customer${data.result.customers === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error("Assignment failed", error instanceof Error ? error.message : "Could not assign user product prices.");
    } finally {
      setAssigningAll(false);
    }
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Customer product price settings" surface="vehicle">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Product Prices</h1>
              <p className="mt-1 text-sm text-muted">Set customer-specific product prices for customers on this vehicle route.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={assigningAll || loading || !customers.length || !products.length} onClick={openAssignAllProductPrices} type="button">
                <IndianRupee size={16} />
                Assign All User Product Prices
              </button>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
            </div>
          </div>
          {loading ? <LoadingSpinner label="Loading customers and products" /> : null}
          <div className="grid gap-3 p-3 sm:hidden">
            {customers.map((customer) => (
              <article className="rounded-lg border border-line bg-panel2 p-3" key={customer.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{customer.name}</h2>
                    <p className="mt-1 truncate text-xs text-muted">{customer.phone || "No phone"}</p>
                    <p className="mt-1 truncate text-xs text-muted">{customer.city || "No city"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-semibold uppercase text-muted">Due</p>
                    <p className="text-sm font-semibold">{formatAmount(customer.dueBalance)}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-xs font-semibold" onClick={() => openPrices(customer, "view")} type="button"><Eye size={14} /> View</button>
                  <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-3 text-xs font-semibold text-white" onClick={() => openPrices(customer, "edit")} type="button"><IndianRupee size={14} /> Assign Price</button>
                </div>
              </article>
            ))}
            {!loading && !customers.length ? (
              <div className="rounded-lg border border-line bg-panel2 px-4 py-8 text-center text-sm text-muted">No customers assigned to this vehicle route.</div>
            ) : null}
          </div>
          <div className="hidden max-h-[700px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{customer.name}</span>
                      <span className="text-xs text-muted">{customer.city || "No city"}</span>
                    </td>
                    <td className="px-4 py-3">{customer.phone || "-"}</td>
                    <td className="px-4 py-3">{customer.route?.name || "Assigned route"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAmount(customer.dueBalance)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold" onClick={() => openPrices(customer, "view")} type="button"><Eye size={14} /> View</button>
                        <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-xs font-semibold text-white" onClick={() => openPrices(customer, "edit")} type="button"><IndianRupee size={14} /> Assign Product Price</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !customers.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-muted" colSpan={5}>No customers assigned to this vehicle route.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line p-4 text-sm text-muted">
            Visible customers: <span className="font-semibold text-ink">{customers.length}</span>
            <span className="px-2">·</span>
            Products: <span className="font-semibold text-ink">{products.length}</span>
          </div>
        </section>
      </div>

      <Modal
        open={bulkOpen}
        title="Assign All User Product Prices"
        description={`${customers.length} customer${customers.length === 1 ? "" : "s"} will receive these product prices.`}
        onClose={() => { if (!assigningAll) setBulkOpen(false); }}
      >
        <div className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchableSelect
              className="sm:w-72"
              onChange={setBulkCategoryFilter}
              options={categoryOptions}
              placeholder="All categories"
              searchPlaceholder="Search categories"
              value={bulkCategoryFilter}
            />
            <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-4 font-semibold text-white disabled:opacity-50" disabled={assigningAll || !products.length || !customers.length} onClick={assignAllUserProductPrices} type="button">
              <IndianRupee size={16} />
              {assigningAll ? "Applying..." : "Apply To All Users"}
            </button>
          </div>
          {assigningAll ? <LoadingSpinner label="Applying product prices to all users" /> : null}
          <div className="max-h-[62vh] overflow-auto rounded-lg border border-line sm:hidden">
            <div className="grid gap-3 p-3">
              {bulkFilteredProducts.map((product) => (
                <article className="rounded-lg border border-line bg-panel2 p-3" key={product.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{product.name}</h3>
                      <p className="mt-1 text-xs text-muted">{productCategory(product)}</p>
                      <p className="mt-1 text-xs text-muted">Bakery base {formatAmount(product.unitPrice)}</p>
                    </div>
                    <input
                      className="h-10 w-28 shrink-0 rounded-md border border-line bg-panel px-3 text-right font-semibold outline-none focus:border-mint"
                      disabled={assigningAll}
                      min="0"
                      onChange={(event) => setBulkPriceMap((current) => ({ ...current, [product.id]: event.target.value }))}
                      type="number"
                      value={bulkPriceMap[product.id] ?? String(product.unitPrice)}
                    />
                  </div>
                </article>
              ))}
              {!bulkFilteredProducts.length ? (
                <div className="rounded-lg border border-line bg-panel2 px-4 py-8 text-center text-sm text-muted">No products in this category.</div>
              ) : null}
            </div>
          </div>
          <div className="hidden max-h-[62vh] overflow-auto rounded-lg border border-line sm:block">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Bakery Base Price</th>
                  <th className="px-4 py-3 text-right">Assign Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bulkFilteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3 font-semibold">{product.name}</td>
                    <td className="px-4 py-3 text-muted">{productCategory(product)}</td>
                    <td className="px-4 py-3 text-right">{formatAmount(product.unitPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        className="ml-auto h-10 w-32 rounded-md border border-line bg-panel2 px-3 text-right font-semibold outline-none focus:border-mint"
                        disabled={assigningAll}
                        min="0"
                        onChange={(event) => setBulkPriceMap((current) => ({ ...current, [product.id]: event.target.value }))}
                        type="number"
                        value={bulkPriceMap[product.id] ?? String(product.unitPrice)}
                      />
                    </td>
                  </tr>
                ))}
                {!bulkFilteredProducts.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted" colSpan={4}>No products in this category.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(priceModal)}
        title={priceModal?.mode === "view" ? "View product prices" : "Assign product prices"}
        description={priceModal ? priceModal.customer.name : ""}
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
            {loadingPrices ? <LoadingSpinner label="Loading product prices" /> : null}
            <div className="max-h-[62vh] overflow-auto rounded-lg border border-line sm:hidden">
              <div className="grid gap-3 p-3">
                {filteredProducts.map((product) => (
                  <article className="rounded-lg border border-line bg-panel2 p-3" key={product.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{product.name}</h3>
                        <p className="mt-1 text-xs text-muted">{productCategory(product)}</p>
                        <p className="mt-1 text-xs text-muted">Bakery base {formatAmount(product.unitPrice)}</p>
                        <p className="mt-1 text-xs text-muted">Vehicle base {vehicleBasePriceMap[product.id] !== undefined ? formatAmount(vehicleBasePriceMap[product.id]) : "-"}</p>
                      </div>
                      {priceModal.mode === "view" ? (
                        <span className="shrink-0 text-sm font-semibold">{formatAmount(priceMap[product.id] ?? product.unitPrice)}</span>
                      ) : (
                        <input
                          className="h-10 w-28 shrink-0 rounded-md border border-line bg-panel px-3 text-right font-semibold outline-none focus:border-mint"
                          min="0"
                          onChange={(event) => setPriceMap((current) => ({ ...current, [product.id]: event.target.value }))}
                          type="number"
                          value={priceMap[product.id] ?? String(product.unitPrice)}
                        />
                      )}
                    </div>
                  </article>
                ))}
                {!filteredProducts.length ? (
                  <div className="rounded-lg border border-line bg-panel2 px-4 py-8 text-center text-sm text-muted">No products in this category.</div>
                ) : null}
              </div>
            </div>
            <div className="hidden max-h-[62vh] overflow-auto rounded-lg border border-line sm:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Bakery Base Price</th>
                    <th className="px-4 py-3 text-right">Vehicle Base Price</th>
                    <th className="px-4 py-3 text-right">Customer Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-semibold">{product.name}</td>
                      <td className="px-4 py-3 text-muted">{productCategory(product)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(product.unitPrice)}</td>
                      <td className="px-4 py-3 text-right">{vehicleBasePriceMap[product.id] !== undefined ? formatAmount(vehicleBasePriceMap[product.id]) : "-"}</td>
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
                      <td className="px-4 py-8 text-center text-muted" colSpan={5}>No products in this category.</td>
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
