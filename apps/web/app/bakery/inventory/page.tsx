"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Eye, History, PackagePlus, Plus, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaginationControls, usePagination } from "../../../components/pagination";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Category = {
  id: string;
  name: string;
  active: boolean;
};

type ProductStock = {
  id: string;
  name: string;
  category: string;
  unitPrice: string;
  stockOnHand: number;
  requiredQuantity: number;
  availableAfterOrders: number;
  stockStatus: "OK" | "SHORT" | "OUT";
  active: boolean;
  stockUpdatedAt?: string | null;
  categoryRef?: Category | null;
};

type RawMaterialLedger = {
  id: string;
  type: "BUY" | "USE";
  quantity: string | number;
  unitPrice?: string | number | null;
  totalAmount?: string | number | null;
  note?: string | null;
  happenedAt: string;
};

type RawMaterial = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  unit: string;
  stockOnHand: string | number;
  reorderAt: string | number;
  unitPrice?: string | number | null;
  ledger?: RawMaterialLedger[];
};

const today = new Date();
const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
const initialDate = today.toISOString().slice(0, 10);

const initialMaterialForm = {
  name: "",
  category: "",
  unit: "kg",
  stockOnHand: "",
  unitPrice: "",
  description: ""
};

function formatNumber(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function statusClass(status: ProductStock["stockStatus"]) {
  if (status === "OUT") return "border-berry/30 bg-berry/10 text-berry";
  if (status === "SHORT") return "border-amber-400/40 bg-amber-100 text-amber-700";
  return "border-mint/30 bg-mint/10 text-mint";
}

export default function BakeryInventoryPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"products" | "materials">("products");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductStock[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialCategory, setMaterialCategory] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [filterMode, setFilterMode] = useState<"date" | "month">("month");
  const [date, setDate] = useState(initialDate);
  const [month, setMonth] = useState(initialMonth);
  const [stockProduct, setStockProduct] = useState<ProductStock | null>(null);
  const [stockForm, setStockForm] = useState({ quantity: "", mode: "ADD" as "ADD" | "SET" });
  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialForm, setMaterialForm] = useState(initialMaterialForm);
  const [adjustMaterial, setAdjustMaterial] = useState<RawMaterial | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: "BUY" as "BUY" | "USE", quantity: "", unitPrice: "", note: "", happenedAt: initialDate });
  const [ledgerMaterial, setLedgerMaterial] = useState<RawMaterial | null>(null);
  const [ledger, setLedger] = useState<RawMaterialLedger[]>([]);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";
  const routeBase = tenantSlug ? `/${tenantSlug}` : "";

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.name, product.categoryRef?.name, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [products, search]);

  const materialCategories = useMemo(() => {
    return Array.from(new Set(materials.map((material) => material.category).filter(Boolean))).sort();
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    const query = materialSearch.trim().toLowerCase();
    return materials.filter((material) => {
      const matchesCategory = materialCategory === "all" || material.category === materialCategory;
      const matchesSearch =
        !query ||
        [material.name, material.category, material.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [materials, materialCategory, materialSearch]);
  const productsPage = usePagination(filteredProducts, 25);
  const materialsPage = usePagination(filteredMaterials, 25);

  const totals = useMemo(() => {
    return products.reduce(
      (summary, product) => ({
        stock: summary.stock + product.stockOnHand,
        required: summary.required + product.requiredQuantity,
        short: summary.short + (product.stockStatus === "SHORT" || product.stockStatus === "OUT" ? 1 : 0)
      }),
      { stock: 0, required: 0, short: 0 }
    );
  }, [products]);

  const materialTotals = useMemo(() => {
    return materials.reduce(
      (summary, material) => ({
        stock: summary.stock + Number(material.stockOnHand || 0),
        value: summary.value + Number(material.stockOnHand || 0) * Number(material.unitPrice || 0),
        low: summary.low + (Number(material.reorderAt || 0) > 0 && Number(material.stockOnHand || 0) <= Number(material.reorderAt || 0) ? 1 : 0)
      }),
      { stock: 0, value: 0, low: 0 }
    );
  }, [materials]);

  async function loadData() {
    if (!apiBase) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryId !== "all") params.set("categoryId", categoryId);
      params.set(filterMode, filterMode === "date" ? date : month);
      const [categoryData, stockData, materialData] = await Promise.all([
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`),
        authFetch<{ products: ProductStock[] }>(`${apiBase}/inventory/product-stock?${params.toString()}`),
        authFetch<{ items: RawMaterial[] }>(`${apiBase}/inventory/items`)
      ]);
      setCategories(categoryData.categories);
      setProducts(stockData.products);
      setMaterials(materialData.items);
    } catch (error) {
      toast.error("Could not load inventory", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [categoryId, filterMode, date, month]);

  function openStockModal(product: ProductStock) {
    setStockProduct(product);
    setStockForm({ quantity: "", mode: "ADD" });
  }

  async function saveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !stockProduct) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/inventory/product-stock/adjust`, {
        method: "POST",
        body: JSON.stringify({
          productId: stockProduct.id,
          quantity: Number(stockForm.quantity || 0),
          mode: stockForm.mode
        })
      });
      toast.success("Stock updated", `${stockProduct.name} stock was ${stockForm.mode === "SET" ? "set" : "increased"}.`);
      setStockProduct(null);
      await loadData();
    } catch (error) {
      toast.error("Stock update failed", error instanceof Error ? error.message : "Could not update product stock.");
    } finally {
      setSaving(false);
    }
  }

  async function createMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/inventory/items`, {
        method: "POST",
        body: JSON.stringify({
          name: materialForm.name,
          category: materialForm.category || "General",
          unit: materialForm.unit,
          stockOnHand: Number(materialForm.stockOnHand || 0),
          unitPrice: materialForm.unitPrice ? Number(materialForm.unitPrice) : undefined,
          description: materialForm.description || undefined
        })
      });
      toast.success("Raw material created", `${materialForm.name} was added to inventory.`);
      setMaterialForm(initialMaterialForm);
      setMaterialOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Raw material creation failed", error instanceof Error ? error.message : "Could not create raw material.");
    } finally {
      setSaving(false);
    }
  }

  function openAdjustMaterial(material: RawMaterial, type: "BUY" | "USE") {
    setAdjustMaterial(material);
    setAdjustForm({
      type,
      quantity: "",
      unitPrice: type === "BUY" && material.unitPrice ? String(material.unitPrice) : "",
      note: "",
      happenedAt: initialDate
    });
  }

  async function saveMaterialAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !adjustMaterial) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/inventory/items/adjust`, {
        method: "POST",
        body: JSON.stringify({
          itemId: adjustMaterial.id,
          type: adjustForm.type,
          quantity: Number(adjustForm.quantity || 0),
          unitPrice: adjustForm.unitPrice ? Number(adjustForm.unitPrice) : undefined,
          note: adjustForm.note || undefined,
          happenedAt: adjustForm.happenedAt
        })
      });
      toast.success("Raw material updated", `${adjustMaterial.name} was ${adjustForm.type === "BUY" ? "purchased" : "used"}.`);
      setAdjustMaterial(null);
      await loadData();
    } catch (error) {
      toast.error("Raw material update failed", error instanceof Error ? error.message : "Could not update raw material.");
    } finally {
      setSaving(false);
    }
  }

  async function openLedger(material: RawMaterial) {
    if (!apiBase) return;
    setLedgerMaterial(material);
    try {
      const data = await authFetch<{ ledger: RawMaterialLedger[] }>(`${apiBase}/inventory/items/${material.id}/ledger`);
      setLedger(data.ledger);
    } catch (error) {
      toast.error("Could not load ledger", error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Product stock, raw materials, and movement ledger" surface="bakery">
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            className={`focus-ring rounded-md border px-4 py-2 text-sm font-semibold ${activeTab === "products" ? "border-mint bg-mint text-white" : "border-line bg-panel"}`}
            onClick={() => setActiveTab("products")}
            type="button"
          >
            Product Stock
          </button>
          <button
            className={`focus-ring rounded-md border px-4 py-2 text-sm font-semibold ${activeTab === "materials" ? "border-mint bg-mint text-white" : "border-line bg-panel"}`}
            onClick={() => setActiveTab("materials")}
            type="button"
          >
            Raw Materials
          </button>
        </div>

        {activeTab === "products" ? (
          <>
            <section className="rounded-lg border border-line bg-panel shadow-subtle">
              <div className="flex min-w-0 flex-col gap-3 border-b border-line p-3 xl:flex-row xl:items-center xl:justify-end">
                <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap">
                  <select className="min-w-0 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
                    <option value="all">All categories</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <select className="min-w-0 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setFilterMode(event.target.value as "date" | "month")} value={filterMode}>
                    <option value="month">Month</option>
                    <option value="date">Date</option>
                  </select>
                  <label className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
                    <CalendarDays size={16} className="text-muted" />
                    {filterMode === "month" ? (
                      <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" onChange={(event) => setMonth(event.target.value)} type="month" value={month} />
                    ) : (
                      <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
                    )}
                  </label>
                  <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh stock" type="button">
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              <div className="border-b border-line p-3">
                <label className="flex max-w-md items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
                  <Search size={16} className="text-muted" />
                  <input className="w-full bg-transparent text-sm outline-none" onChange={(event) => setSearch(event.target.value)} placeholder="Search product or category" value={search} />
                </label>
              </div>

              {loading ? <LoadingSpinner label="Loading stock" /> : null}
              <PaginationControls
                {...productsPage}
                summary={[
                  { label: "Stock", value: formatNumber(totals.stock) },
                  { label: "Required", value: formatNumber(totals.required) },
                  { label: "Short", value: totals.short }
                ]}
              />

              <div className="grid gap-3 p-3 sm:hidden">
                {productsPage.pageItems.map((product) => (
                  <article key={product.id} className="rounded-lg border border-line bg-panel2 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{product.name}</h3>
                        <p className="text-xs text-muted">{product.categoryRef?.name || product.category}</p>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(product.stockStatus)}`}>
                        {product.stockStatus === "OK" ? "Available" : product.stockStatus === "SHORT" ? "Short" : "Out"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <span>
                        <span className="block text-xs text-muted">Stock</span>
                        <span className="font-semibold">{formatNumber(product.stockOnHand)}</span>
                      </span>
                      <span>
                        <span className="block text-xs text-muted">Required</span>
                        <span className="font-semibold">{formatNumber(product.requiredQuantity)}</span>
                      </span>
                      <span>
                        <span className="block text-xs text-muted">After</span>
                        <span className={product.availableAfterOrders < 0 ? "font-semibold text-berry" : "font-semibold text-mint"}>
                          {formatNumber(product.availableAfterOrders)}
                        </span>
                      </span>
                    </div>
                    <button className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-white" onClick={() => openStockModal(product)} type="button">
                      <PackagePlus size={15} />
                      Add Stock
                    </button>
                  </article>
                ))}
                {!loading && !filteredProducts.length ? (
                  <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No products found for this filter.</p>
                ) : null}
              </div>

              <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
                <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-right">Order requirement</th>
                      <th className="px-4 py-3 text-right">After orders</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {productsPage.pageItems.map((product) => (
                      <tr key={product.id}>
                        <td className="px-4 py-3">
                          <span className="block font-semibold">{product.name}</span>
                          <span className="text-xs text-muted">{product.active ? "Active product" : "Inactive product"}</span>
                        </td>
                        <td className="px-4 py-3">{product.categoryRef?.name || product.category}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatNumber(product.stockOnHand)}</td>
                        <td className="px-4 py-3 text-right">{formatNumber(product.requiredQuantity)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${product.availableAfterOrders < 0 ? "text-berry" : "text-mint"}`}>{formatNumber(product.availableAfterOrders)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(product.stockStatus)}`}>
                            {product.stockStatus === "OK" ? "Available" : product.stockStatus === "SHORT" ? "Short" : "Out"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-white" onClick={() => openStockModal(product)} type="button">
                            <PackagePlus size={15} />
                            Add Stock
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loading && !filteredProducts.length ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted" colSpan={7}>No products found for this filter.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="rounded-lg border border-line bg-panel shadow-subtle">
              <div className="flex min-w-0 flex-col gap-3 border-b border-line p-3 xl:flex-row xl:items-center xl:justify-end">
                <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap">
                  <Link className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" href={`${routeBase}/bakery/inventory/sellers`}>
                    Seller Payments
                  </Link>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setMaterialOpen(true)} type="button">
                    <Plus size={16} />
                    Add Material
                  </button>
                  <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh materials" type="button">
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex max-w-md flex-1 items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
                  <Search size={16} className="text-muted" />
                  <input className="w-full bg-transparent text-sm outline-none" onChange={(event) => setMaterialSearch(event.target.value)} placeholder="Search material or category" value={materialSearch} />
                </label>
                <select className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setMaterialCategory(event.target.value)} value={materialCategory}>
                  <option value="all">All categories</option>
                  {materialCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>

              {loading ? <LoadingSpinner label="Loading materials" /> : null}
              <PaginationControls
                {...materialsPage}
                summary={[
                  { label: "Quantity", value: formatNumber(materialTotals.stock) },
                  { label: "Value", value: formatAmount(materialTotals.value) },
                  { label: "Low", value: materialTotals.low }
                ]}
              />

              <div className="grid gap-3 p-3 sm:hidden">
                {materialsPage.pageItems.map((material) => {
                  const last = material.ledger?.[0];
                  const value = Number(material.stockOnHand || 0) * Number(material.unitPrice || 0);
                  return (
                    <article key={material.id} className="rounded-lg border border-line bg-panel2 p-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{material.name}</h3>
                        <p className="text-xs text-muted">{material.category}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <span>
                          <span className="block text-xs text-muted">Qty</span>
                          <span className="font-semibold">{formatNumber(material.stockOnHand)} {material.unit}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-muted">Price</span>
                          <span className="font-semibold">{material.unitPrice ? formatAmount(material.unitPrice) : "-"}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-muted">Value</span>
                          <span className="font-semibold">{value ? formatAmount(value) : "-"}</span>
                        </span>
                      </div>
                      <div className="mt-3 rounded-md bg-panel px-3 py-2 text-xs">
                        {last ? (
                          <>
                            <span className={last.type === "BUY" ? "font-semibold text-mint" : "font-semibold text-berry"}>{last.type}</span>
                            <span className="text-muted"> · {formatNumber(last.quantity)} {material.unit} · {formatDate(last.happenedAt)}</span>
                          </>
                        ) : (
                          <span className="text-muted">No movement</span>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openAdjustMaterial(material, "BUY")} title="Buy material" type="button">
                          <PackagePlus size={15} />
                        </button>
                        <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openAdjustMaterial(material, "USE")} title="Use material" type="button">
                          <History size={15} />
                        </button>
                        <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openLedger(material)} title="View ledger" type="button">
                          <Eye size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
                {!loading && !filteredMaterials.length ? (
                  <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No raw materials found.</p>
                ) : null}
              </div>

              <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
                <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3">Last movement</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {materialsPage.pageItems.map((material) => {
                      const last = material.ledger?.[0];
                      const value = Number(material.stockOnHand || 0) * Number(material.unitPrice || 0);
                      return (
                        <tr key={material.id}>
                          <td className="px-4 py-3">
                            <span className="block font-semibold">{material.name}</span>
                            <span className="text-xs text-muted">{material.description || "No description"}</span>
                          </td>
                          <td className="px-4 py-3">{material.category}</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatNumber(material.stockOnHand)} {material.unit}</td>
                          <td className="px-4 py-3 text-right">{material.unitPrice ? formatAmount(material.unitPrice) : "-"}</td>
                          <td className="px-4 py-3 text-right">{value ? formatAmount(value) : "-"}</td>
                          <td className="px-4 py-3">
                            {last ? (
                              <span className="text-xs">
                                <span className={last.type === "BUY" ? "font-semibold text-mint" : "font-semibold text-berry"}>{last.type}</span>
                                <span className="text-muted"> · {formatNumber(last.quantity)} {material.unit} · {formatDate(last.happenedAt)}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted">No movement</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => openAdjustMaterial(material, "BUY")} title="Buy material" type="button">
                                <PackagePlus size={15} />
                              </button>
                              <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => openAdjustMaterial(material, "USE")} title="Use material" type="button">
                                <History size={15} />
                              </button>
                              <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => openLedger(material)} title="View ledger" type="button">
                                <Eye size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!loading && !filteredMaterials.length ? (
                      <tr>
                        <td className="px-4 py-8 text-center text-muted" colSpan={7}>No raw materials found.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>

      <Modal open={Boolean(stockProduct)} title={stockProduct ? `Update stock: ${stockProduct.name}` : "Update stock"} description="Add newly prepared stock or set the current product stock directly." onClose={() => setStockProduct(null)}>
        <form className="grid gap-4" onSubmit={saveStock}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Mode
              <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setStockForm((current) => ({ ...current, mode: event.target.value as "ADD" | "SET" }))} value={stockForm.mode}>
                <option value="ADD">Add to stock</option>
                <option value="SET">Set stock</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Quantity
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0.001" onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="0" required step="0.001" type="number" value={stockForm.quantity} />
            </label>
          </div>
          <div className="rounded-md border border-line bg-panel2 p-3 text-sm text-muted">
            Current stock: <span className="font-semibold text-ink">{formatNumber(stockProduct?.stockOnHand || 0)}</span>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setStockProduct(null)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Stock"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={materialOpen} title="Create raw material" description="Add flour, sugar, boxes, cream, or any other bakery material." onClose={() => setMaterialOpen(false)}>
        <form className="grid gap-4" onSubmit={createMaterial}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Name
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setMaterialForm((current) => ({ ...current, name: event.target.value }))} required value={materialForm.name} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Category
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setMaterialForm((current) => ({ ...current, category: event.target.value }))} placeholder="Flour, Dairy, Packaging" required value={materialForm.category} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Unit
              <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setMaterialForm((current) => ({ ...current, unit: event.target.value }))} value={materialForm.unit}>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="ltr">ltr</option>
                <option value="pcs">pcs</option>
                <option value="box">box</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Opening quantity
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0" onChange={(event) => setMaterialForm((current) => ({ ...current, stockOnHand: event.target.value }))} placeholder="0" step="0.001" type="number" value={materialForm.stockOnHand} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Price per unit
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0" onChange={(event) => setMaterialForm((current) => ({ ...current, unitPrice: event.target.value }))} placeholder="Optional" step="0.01" type="number" value={materialForm.unitPrice} />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">
            Description
            <textarea className="min-h-24 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setMaterialForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional" value={materialForm.description} />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setMaterialOpen(false)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Create Material"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(adjustMaterial)} title={adjustMaterial ? `${adjustForm.type === "BUY" ? "Buy" : "Use"}: ${adjustMaterial.name}` : "Update raw material"} description="Every movement is recorded in the material ledger." onClose={() => setAdjustMaterial(null)}>
        <form className="grid gap-4" onSubmit={saveMaterialAdjustment}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Type
              <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setAdjustForm((current) => ({ ...current, type: event.target.value as "BUY" | "USE" }))} value={adjustForm.type}>
                <option value="BUY">Buy / Add</option>
                <option value="USE">Use / Consume</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Date
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setAdjustForm((current) => ({ ...current, happenedAt: event.target.value }))} type="date" value={adjustForm.happenedAt} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Quantity
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0.001" onChange={(event) => setAdjustForm((current) => ({ ...current, quantity: event.target.value }))} required step="0.001" type="number" value={adjustForm.quantity} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Price per unit
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0" onChange={(event) => setAdjustForm((current) => ({ ...current, unitPrice: event.target.value }))} placeholder="Optional" step="0.01" type="number" value={adjustForm.unitPrice} />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">
            Reason / note
            <textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setAdjustForm((current) => ({ ...current, note: event.target.value }))} placeholder="Optional" value={adjustForm.note} />
          </label>
          <div className="rounded-md border border-line bg-panel2 p-3 text-sm text-muted">
            Current stock: <span className="font-semibold text-ink">{formatNumber(adjustMaterial?.stockOnHand)} {adjustMaterial?.unit}</span>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setAdjustMaterial(null)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Movement"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(ledgerMaterial)} title={ledgerMaterial ? `${ledgerMaterial.name} ledger` : "Raw material ledger"} description="Buy and use history for this material." onClose={() => setLedgerMaterial(null)}>
        <div className="max-h-[520px] w-full max-w-full overflow-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ledger.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-2">{formatDate(entry.happenedAt)}</td>
                  <td className="px-3 py-2">
                    <span className={entry.type === "BUY" ? "font-semibold text-mint" : "font-semibold text-berry"}>{entry.type}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(entry.quantity)} {ledgerMaterial?.unit}</td>
                  <td className="px-3 py-2 text-right">{entry.unitPrice ? formatAmount(entry.unitPrice) : "-"}</td>
                  <td className="px-3 py-2 text-right">{entry.totalAmount ? formatAmount(entry.totalAmount) : "-"}</td>
                  <td className="px-3 py-2 text-muted">{entry.note || "-"}</td>
                </tr>
              ))}
              {!ledger.length ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted" colSpan={6}>No ledger history yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Modal>
    </AppShell>
  );
}
