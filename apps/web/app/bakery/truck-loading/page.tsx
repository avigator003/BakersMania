"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Category = { id: string; name: string };
type TruckLoading = {
  date: string;
  orderCount: number;
  products: { id: string; name: string; category: string }[];
  routes: { id: string; name: string; quantities: Record<string, number>; total: number }[];
  totals: Record<string, number>;
};

const today = new Date().toISOString().slice(0, 10);

function formatQty(value?: string | number | null) {
  const amount = Number(value || 0);
  return amount ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount) : "";
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function BakeryTruckLoadingPage() {
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [truckLoading, setTruckLoading] = useState<TruckLoading | null>(null);
  const [loading, setLoading] = useState(true);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (categoryId !== "all") params.set("categoryId", categoryId);
      const [truckData, categoryData] = await Promise.all([
        authFetch<{ truckLoading: TruckLoading }>(`${apiBase}/orders/truck-loading?${params.toString()}`),
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`)
      ]);
      setTruckLoading(truckData.truckLoading);
      setCategories(categoryData.categories);
    } catch (error) {
      toast.error("Could not load truck sheet", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date, categoryId]);

  const totalQuantity = useMemo(() => truckLoading?.routes.reduce((sum, route) => sum + route.total, 0) || 0, [truckLoading]);

  function exportTruckLoading() {
    if (!truckLoading) return;
    const header = ["Route Name", ...truckLoading.products.map((product) => product.name), "Total"];
    const rows = truckLoading.routes.map((route) => [
      route.name,
      ...truckLoading.products.map((product) => route.quantities[product.id] || ""),
      route.total || ""
    ]);
    const totalRow = ["Product Total", ...truckLoading.products.map((product) => truckLoading.totals[product.id] || ""), totalQuantity || ""];
    const csv = [header, ...rows, totalRow].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `truck-loading-${truckLoading.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Truck loading by route and product" surface="bakery">
      <section className="rounded-lg border border-line bg-panel shadow-subtle">
        <div className="flex flex-col gap-3 border-b border-line p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span>Routes: <span className="font-semibold text-ink">{truckLoading?.routes.length || 0}</span></span>
            <span>Products: <span className="font-semibold text-ink">{truckLoading?.products.length || 0}</span></span>
            <span>Orders: <span className="font-semibold text-ink">{truckLoading?.orderCount || 0}</span></span>
            <span>Qty: <span className="font-semibold text-ink">{formatQty(totalQuantity) || "0"}</span></span>
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
              <option value="all">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <input className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
            <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" disabled={!truckLoading?.routes.length} onClick={exportTruckLoading} type="button"><Download size={16} /> Export</button>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh loading" type="button"><RefreshCw size={16} /></button>
          </div>
        </div>

        {loading ? <LoadingSpinner label="Loading truck sheet" /> : null}

        <div className="max-h-[700px] w-full max-w-full overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-center text-sm">
            <thead className="sticky top-0 z-20 text-xs uppercase text-muted">
              <tr>
                <th className="sticky left-0 z-40 min-w-44 border-b border-r border-line bg-panel2 px-4 py-3 text-left shadow-[8px_0_12px_rgba(23,32,51,0.08)]">Route Name</th>
                {truckLoading?.products.map((product) => (
                  <th className="min-w-28 border-b border-r border-line bg-panel2 px-3 py-3" key={product.id}>
                    <span className="block text-ink">{product.name}</span>
                    <span className="mt-1 block text-[11px] normal-case text-muted">{product.category}</span>
                  </th>
                ))}
                <th className="sticky right-0 z-40 min-w-24 border-b border-line bg-panel2 px-4 py-3 shadow-[-8px_0_12px_rgba(23,32,51,0.08)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {truckLoading?.routes.map((route, index) => (
                <tr className={index % 2 ? "bg-panel2/30" : "bg-panel"} key={route.id}>
                  <td className={`sticky left-0 z-30 border-b border-r border-line px-4 py-3 text-left font-semibold text-ink shadow-[8px_0_12px_rgba(23,32,51,0.06)] ${index % 2 ? "bg-panel2" : "bg-panel"}`}>{route.name}</td>
                  {truckLoading.products.map((product) => {
                    const quantity = route.quantities[product.id] || 0;
                    return (
                      <td className={`border-b border-r border-line px-3 py-3 ${quantity ? "font-semibold text-ink" : "text-muted"}`} key={product.id}>
                        {formatQty(quantity) || "-"}
                      </td>
                    );
                  })}
                  <td className={`sticky right-0 z-30 border-b border-line px-4 py-3 font-bold text-mint shadow-[-8px_0_12px_rgba(23,32,51,0.06)] ${index % 2 ? "bg-panel2" : "bg-panel"}`}>{formatQty(route.total) || "-"}</td>
                </tr>
              ))}
              {truckLoading && truckLoading.products.length ? (
                <tr className="bg-mint/10 font-bold">
                  <td className="sticky left-0 z-30 border-b border-r border-line bg-[#e7f4f0] px-4 py-3 text-left shadow-[8px_0_12px_rgba(23,32,51,0.06)]">Product Total</td>
                  {truckLoading.products.map((product) => <td className="border-b border-r border-line px-3 py-3" key={product.id}>{formatQty(truckLoading.totals[product.id]) || "-"}</td>)}
                  <td className="sticky right-0 z-30 border-b border-line bg-[#e7f4f0] px-4 py-3 text-mint shadow-[-8px_0_12px_rgba(23,32,51,0.06)]">{formatQty(totalQuantity) || "-"}</td>
                </tr>
              ) : null}
              {!loading && (!truckLoading || !truckLoading.routes.length) ? (
                <tr>
                  <td className="px-4 py-10 text-center text-muted" colSpan={(truckLoading?.products.length || 0) + 2}>No truck loading data for this date.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
