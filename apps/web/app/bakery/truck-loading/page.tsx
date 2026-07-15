"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type TruckLoading = {
  date: string;
  orderCount: number;
  products: { id: string; name: string; category: string; updatedAt?: string }[];
  routes: { id: string; name: string; updatedAt?: string; quantities: Record<string, number>; total: number }[];
  totals: Record<string, number>;
};

const today = localDateInput();
const naturalSort = new Intl.Collator("en-IN", { numeric: true, sensitivity: "base" });

function formatQty(value?: string | number | null) {
  const amount = Number(value || 0);
  return amount ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount) : "";
}

function escapeExcelValue(value: string | number | null | undefined) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function excelAttrs(className: string) {
  const squareAttrs = className.split(/\s+/).includes("square-cell")
    ? ' width="64" height="64" style="width:64px;min-width:64px;max-width:64px;height:64px;min-height:64px;max-height:64px;text-align:center;vertical-align:middle;white-space:normal;word-break:break-word;overflow-wrap:anywhere;"'
    : "";
  return ` class="${className}"${squareAttrs}`;
}

function excelCell(value: string | number | null | undefined, className = "") {
  return `<td${excelAttrs(className)}>${escapeExcelValue(value)}</td>`;
}

function excelHeader(value: string | number | null | undefined, className = "") {
  return `<th${excelAttrs(className)}>${escapeExcelValue(value)}</th>`;
}

function excelColumn(width: number) {
  return `<col style="width:${width}px;min-width:${width}px;max-width:${width}px;" width="${width}" />`;
}

function exportExcel(filename: string, rows: string[], columns: string[] = []) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; table-layout: fixed; font-family: Arial, sans-serif; font-size: 10pt; }
    th, td { border: 1px solid #1f2937; height: 64px; text-align: center; vertical-align: middle; white-space: normal; mso-number-format: General; }
    th { background: #e7f4f0; font-weight: 700; }
    .meta-label { min-width: 92pt; width: 92pt; height: 24pt; text-align: left; background: #f3f4f6; font-weight: 700; }
    .meta-value { min-width: 180pt; width: 180pt; height: 24pt; text-align: left; }
    .name-cell { min-width: 130pt; width: 130pt; text-align: left; font-weight: 700; }
    .square-cell { min-width: 64px !important; width: 64px !important; max-width: 64px !important; height: 64px !important; max-height: 64px !important; word-break: break-word; overflow-wrap: anywhere; }
    .summary-cell { background: #f3f4f6; font-weight: 700; }
  </style>
</head>
<body><table>${columns.length ? `<colgroup>${columns.join("")}</colgroup>` : ""}${rows.join("")}</table></body>
</html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function updatedAscending(a: { updatedAt?: string | null; name: string }, b: { updatedAt?: string | null; name: string }) {
  const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return aTime - bTime || naturalSort.compare(a.name || "", b.name || "");
}

function productSort(a: TruckLoading["products"][number], b: TruckLoading["products"][number]) {
  return updatedAscending(a, b) || naturalSort.compare(a.category || "General", b.category || "General");
}

export default function BakeryTruckLoadingPage() {
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [routeFilter, setRouteFilter] = useState<string[]>([]);
  const [truckLoading, setTruckLoading] = useState<TruckLoading | null>(null);
  const [loading, setLoading] = useState(true);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      const truckData = await authFetch<{ truckLoading: TruckLoading }>(`${apiBase}/orders/truck-loading?${params.toString()}`);
      setTruckLoading(truckData.truckLoading);
    } catch (error) {
      toast.error("Could not load truck sheet", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  const productOptions = useMemo(() => (truckLoading?.products || []).map((product) => ({
    value: product.id,
    label: product.name,
    description: product.category
  })), [truckLoading]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set((truckLoading?.products || []).map((product) => product.category).filter(Boolean))).sort();
    return categories.map((category) => ({ value: category, label: category }));
  }, [truckLoading]);

  const sortedRoutes = useMemo(() => [...(truckLoading?.routes || [])].sort(updatedAscending), [truckLoading]);

  const routeOptions = useMemo(() => sortedRoutes.map((route) => ({
    value: route.id,
    label: route.name
  })), [sortedRoutes]);

  const visibleProducts = useMemo(() => {
    const products = truckLoading?.products || [];
    const productHasQuantity = new Set<string>();
    sortedRoutes.forEach((route) => {
      Object.entries(route.quantities).forEach(([productId, quantity]) => {
        if (Number(quantity || 0) > 0) productHasQuantity.add(productId);
      });
    });
    return products.filter((product) => {
      const categoryMatches = !categoryFilter.length || categoryFilter.includes(product.category);
      const productMatches = !productFilter.length || productFilter.includes(product.id);
      const hasQuantity = productHasQuantity.has(product.id);
      const shouldShowEmptyProduct = Boolean(categoryFilter.length || productFilter.length);
      return categoryMatches && productMatches && (hasQuantity || shouldShowEmptyProduct);
    }).sort(productSort);
  }, [categoryFilter, productFilter, sortedRoutes, truckLoading]);

  const visibleRoutes = useMemo(() => {
    const routes = sortedRoutes;
    return routeFilter.length ? routes.filter((route) => routeFilter.includes(route.id)) : routes;
  }, [routeFilter, sortedRoutes]);

  function routeTotal(route: TruckLoading["routes"][number]) {
    return visibleProducts.reduce((sum, product) => sum + Number(route.quantities[product.id] || 0), 0);
  }

  const productTotals = useMemo(() => {
    return Object.fromEntries(visibleProducts.map((product) => [
      product.id,
      visibleRoutes.reduce((sum, route) => sum + Number(route.quantities[product.id] || 0), 0)
    ]));
  }, [visibleProducts, visibleRoutes]);

  const totalQuantity = useMemo(() => visibleRoutes.reduce((sum, route) => sum + routeTotal(route), 0), [visibleProducts, visibleRoutes]);

  function exportTruckLoading() {
    if (!truckLoading) return;
    const selectedRoutes = routeFilter.length ? visibleRoutes.map((route) => route.name).join(", ") : "All Routes";
    const productQuantitySummary = visibleProducts.length * totalQuantity;
    const columns = [
      excelColumn(180),
      ...visibleProducts.map(() => excelColumn(64)),
      excelColumn(80)
    ];
    const rows = [
      `<tr>${excelCell("Date", "meta-label")}${excelCell(truckLoading.date, "meta-value")}${excelCell("Route Name", "meta-label")}${excelCell(selectedRoutes, "meta-value")}${excelCell("No of Products * Quantity", "meta-label")}${excelCell(productQuantitySummary, "meta-value")}</tr>`,
      `<tr></tr>`,
      `<tr>${excelHeader("Route Name", "name-cell")}${visibleProducts.map((product) => excelHeader(product.name, "square-cell")).join("")}${excelHeader("Total")}</tr>`,
      ...visibleRoutes.map((route) => {
        const total = routeTotal(route);
        return `<tr>${excelCell(route.name, "name-cell")}${visibleProducts.map((product) => excelCell(route.quantities[product.id] || "", "square-cell")).join("")}${excelCell(total || "")}</tr>`;
      }),
      `<tr>${excelCell("Product Total", "name-cell summary-cell")}${visibleProducts.map((product) => excelCell(productTotals[product.id] || "", "square-cell summary-cell")).join("")}${excelCell(totalQuantity || "", "summary-cell")}</tr>`
    ];
    exportExcel(`truck-loading-${truckLoading.date}.xls`, rows, columns);
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Truck loading by route and product" surface="bakery">
      <section className="rounded-lg border border-line bg-panel shadow-subtle">
        <div className="flex flex-col gap-3 border-b border-line p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span>Routes: <span className="font-semibold text-ink">{visibleRoutes.length}</span></span>
            <span>Products: <span className="font-semibold text-ink">{visibleProducts.length}</span></span>
            <span>Orders: <span className="font-semibold text-ink">{truckLoading?.orderCount || 0}</span></span>
            <span>Qty: <span className="font-semibold text-ink">{formatQty(totalQuantity) || "0"}</span></span>
          </div>
          <div className="flex flex-wrap gap-2">
            <SearchableSelect className="min-w-56" multiple onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={categoryFilter} />
            <SearchableSelect className="min-w-56" multiple onChange={setProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={productFilter} />
            <SearchableSelect className="min-w-52" multiple onChange={setRouteFilter} options={routeOptions} placeholder="All routes" searchPlaceholder="Search routes" value={routeFilter} />
            <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={setDate} value={date} />
            <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" disabled={!visibleRoutes.length || !visibleProducts.length} onClick={exportTruckLoading} type="button"><Download size={16} /> Export</button>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh loading" type="button"><RefreshCw size={16} /></button>
          </div>
        </div>

        {loading ? <LoadingSpinner label="Loading truck sheet" /> : null}

        <div className="max-h-[700px] w-full max-w-full overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-center text-sm">
            <thead className="sticky top-0 z-20 text-xs uppercase text-muted">
              <tr>
                <th className="sticky left-0 z-40 min-w-44 border-b border-r border-line bg-panel2 px-4 py-3 text-left shadow-[8px_0_12px_rgba(23,32,51,0.08)]">Route Name</th>
                {visibleProducts.map((product) => (
                  <th className="min-w-28 border-b border-r border-line bg-panel2 px-3 py-3" key={product.id}>
                    <span className="block text-ink">{product.name}</span>
                    <span className="mt-1 block text-[11px] normal-case text-muted">{product.category}</span>
                  </th>
                ))}
                <th className="sticky right-0 z-40 min-w-24 border-b border-line bg-panel2 px-4 py-3 shadow-[-8px_0_12px_rgba(23,32,51,0.08)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoutes.map((route, index) => (
                <tr className={index % 2 ? "bg-panel2/30" : "bg-panel"} key={route.id}>
                  <td className={`sticky left-0 z-30 border-b border-r border-line px-4 py-3 text-left font-semibold text-ink shadow-[8px_0_12px_rgba(23,32,51,0.06)] ${index % 2 ? "bg-panel2" : "bg-panel"}`}>{route.name}</td>
                  {visibleProducts.map((product) => {
                    const quantity = route.quantities[product.id] || 0;
                    return (
                      <td className={`border-b border-r border-line px-3 py-3 ${quantity ? "font-semibold text-ink" : "text-muted"}`} key={product.id}>
                        {formatQty(quantity) || "-"}
                      </td>
                    );
                  })}
                  <td className={`sticky right-0 z-30 border-b border-line px-4 py-3 font-bold text-mint shadow-[-8px_0_12px_rgba(23,32,51,0.06)] ${index % 2 ? "bg-panel2" : "bg-panel"}`}>{formatQty(routeTotal(route)) || "-"}</td>
                </tr>
              ))}
              {truckLoading && visibleProducts.length ? (
                <tr className="bg-mint/10 font-bold">
                  <td className="sticky left-0 z-30 border-b border-r border-line bg-[#e7f4f0] px-4 py-3 text-left shadow-[8px_0_12px_rgba(23,32,51,0.06)]">Product Total</td>
                  {visibleProducts.map((product) => <td className="border-b border-r border-line px-3 py-3" key={product.id}>{formatQty(productTotals[product.id]) || "-"}</td>)}
                  <td className="sticky right-0 z-30 border-b border-line bg-[#e7f4f0] px-4 py-3 text-mint shadow-[-8px_0_12px_rgba(23,32,51,0.06)]">{formatQty(totalQuantity) || "-"}</td>
                </tr>
              ) : null}
              {!loading && (!truckLoading || !visibleRoutes.length || !visibleProducts.length) ? (
                <tr>
                  <td className="px-4 py-10 text-center text-muted" colSpan={visibleProducts.length + 2}>No truck loading data for this date.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
