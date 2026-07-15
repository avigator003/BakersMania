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
  routes: {
    id: string;
    name: string;
    routeName?: string | null;
    updatedAt?: string;
    quantities: Record<string, number>;
    total: number;
    previousDue: number;
    orderAmount: number;
    paidAmount: number;
    todaysDue: number;
    customerCount?: number;
  }[];
  totals: Record<string, number>;
};
const today = localDateInput();
const naturalSort = new Intl.Collator("en-IN", { numeric: true, sensitivity: "base" });

function formatQty(value?: string | number | null) {
  const amount = Number(value || 0);
  return amount ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount) : "";
}

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function excelCell(value: string | number | null | undefined, className = "") {
  return `<td class="${className}">${String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</td>`;
}

function excelHeader(value: string | number | null | undefined, className = "") {
  return `<th class="${className}">${String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</th>`;
}

function exportExcel(filename: string, rows: string[]) {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 10pt; }
    th, td { border: 1px solid #1f2937; min-width: 48pt; width: 48pt; height: 48pt; text-align: center; vertical-align: middle; white-space: normal; mso-number-format: General; }
    th { background: #e7f4f0; font-weight: 700; }
    .meta-label { min-width: 92pt; width: 92pt; height: 24pt; text-align: left; background: #f3f4f6; font-weight: 700; }
    .meta-value { min-width: 180pt; width: 180pt; height: 24pt; text-align: left; }
    .name-cell { min-width: 130pt; width: 130pt; text-align: left; font-weight: 700; }
    .amount-cell { min-width: 88pt; width: 88pt; text-align: right; }
    .summary-cell { background: #f3f4f6; font-weight: 700; }
  </style>
</head>
<body><table>${rows.join("")}</table></body>
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

export default function VehicleTruckLoadingPage() {
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [truckLoading, setTruckLoading] = useState<TruckLoading | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ date, groupBy: "customer" });
      const data = await authFetch<{ truckLoading: TruckLoading }>(`${apiBase}/orders/truck-loading?${params.toString()}`);
      setTruckLoading(data.truckLoading);
    } catch (error) {
      toast.error("Could not load truck loading", error instanceof Error ? error.message : "Please sign in again.");
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

  const sortedCustomers = useMemo(() => [...(truckLoading?.routes || [])].sort(updatedAscending), [truckLoading]);

  const customerOptions = useMemo(() => sortedCustomers.map((route) => ({
    value: route.id,
    label: route.name,
    description: route.routeName || undefined
  })), [sortedCustomers]);

  const visibleProducts = useMemo(() => {
    const products = truckLoading?.products || [];
    const productHasQuantity = new Set<string>();
    sortedCustomers.forEach((route) => {
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
  }, [categoryFilter, productFilter, sortedCustomers, truckLoading]);

  const visibleRoutes = useMemo(() => {
    const routes = sortedCustomers;
    return customerFilter.length ? routes.filter((route) => customerFilter.includes(route.id)) : routes;
  }, [customerFilter, sortedCustomers]);

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
  const amountTotals = useMemo(() => ({
    orderAmount: visibleRoutes.reduce((sum, route) => sum + Number(route.orderAmount || 0), 0),
    previousDue: visibleRoutes.reduce((sum, route) => sum + Number(route.previousDue || 0), 0),
    paidAmount: visibleRoutes.reduce((sum, route) => sum + Number(route.paidAmount || 0), 0),
    todaysDue: visibleRoutes.reduce((sum, route) => sum + Number(route.todaysDue || 0), 0)
  }), [visibleRoutes]);

  function exportTruckLoading() {
    if (!truckLoading) return;
    const routeNames = Array.from(new Set(visibleRoutes.map((route) => route.routeName).filter(Boolean))).join(", ") || "Assigned Routes";
    const rows = [
      `<tr>${excelCell("Date", "meta-label")}${excelCell(truckLoading.date, "meta-value")}${excelCell("Route Name", "meta-label")}${excelCell(routeNames, "meta-value")}</tr>`,
      `<tr></tr>`,
      `<tr>${excelHeader("Route Name", "name-cell")}${excelHeader("Customer Name", "name-cell")}${visibleProducts.map((product) => excelHeader(product.name)).join("")}${excelHeader("No of Products * Quantity")}${excelHeader("Total Qty")}${excelHeader("Order Amount", "amount-cell")}${excelHeader("Previous Due Amount", "amount-cell")}${excelHeader("Paid Amount", "amount-cell")}${excelHeader("Today's Due Amount", "amount-cell")}</tr>`,
      ...visibleRoutes.map((route) => {
        const productCount = visibleProducts.filter((product) => Number(route.quantities[product.id] || 0) > 0).length;
        const total = routeTotal(route);
        return `<tr>${excelCell(route.routeName || "", "name-cell")}${excelCell(route.name, "name-cell")}${visibleProducts.map((product) => excelCell(route.quantities[product.id] || "")).join("")}${excelCell(total ? `${productCount} * ${formatQty(total)}` : "")}${excelCell(total || "")}${excelCell(route.orderAmount || "", "amount-cell")}${excelCell(route.previousDue || "", "amount-cell")}${excelCell(route.paidAmount || "", "amount-cell")}${excelCell(route.todaysDue || "", "amount-cell")}</tr>`;
      }),
      `<tr>${excelCell("Product Total", "name-cell summary-cell")}${excelCell("", "summary-cell")}${visibleProducts.map((product) => excelCell(productTotals[product.id] || "", "summary-cell")).join("")}${excelCell(`${visibleProducts.length} * ${formatQty(totalQuantity) || "0"}`, "summary-cell")}${excelCell(totalQuantity || "", "summary-cell")}${excelCell(amountTotals.orderAmount || "", "amount-cell summary-cell")}${excelCell(amountTotals.previousDue || "", "amount-cell summary-cell")}${excelCell(amountTotals.paidAmount || "", "amount-cell summary-cell")}${excelCell(amountTotals.todaysDue || "", "amount-cell summary-cell")}</tr>`
    ];
    exportExcel(`vehicle-truck-loading-${truckLoading.date}.xls`, rows);
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Truck loading for assigned routes" surface="vehicle">
      <section className="rounded-lg border border-line bg-panel shadow-subtle">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Truck Loading</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm text-muted">
              <span>Products: <span className="font-semibold text-ink">{visibleProducts.length}</span></span>
              <span>Orders: <span className="font-semibold text-ink">{truckLoading?.orderCount || 0}</span></span>
              <span>Qty: <span className="font-semibold text-ink">{formatQty(totalQuantity) || "0"}</span></span>
              <span>Today&apos;s Due Amount: <span className="font-semibold text-ink">{formatAmount(amountTotals.todaysDue)}</span></span>
            </div>
            <SearchableSelect className="min-w-56" multiple onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={categoryFilter} />
            <SearchableSelect className="min-w-56" multiple onChange={setProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={productFilter} />
            <SearchableSelect className="min-w-52" multiple onChange={setCustomerFilter} options={customerOptions} placeholder="All customers" searchPlaceholder="Search customers" value={customerFilter} />
            <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={setDate} value={date} />
            <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" disabled={!visibleRoutes.length || !visibleProducts.length} onClick={exportTruckLoading} type="button"><Download size={16} /> Export</button>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
          </div>
        </div>

        {loading ? <LoadingSpinner label="Loading truck sheet" /> : null}

        <div className="max-h-[700px] w-full max-w-full overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-center text-sm">
            <thead className="sticky top-0 z-20 text-xs uppercase text-muted">
              <tr>
                <th className="sticky left-0 z-40 min-w-44 border-b border-r border-line bg-panel2 px-4 py-3 text-left shadow-[8px_0_12px_rgba(23,32,51,0.08)]">Route Name</th>
                <th className="min-w-44 border-b border-r border-line bg-panel2 px-4 py-3 text-left">Customer Name</th>
                {visibleProducts.map((product) => (
                  <th className="min-w-28 border-b border-r border-line bg-panel2 px-3 py-3" key={product.id}>
                    <span className="block text-ink">{product.name}</span>
                    <span className="mt-1 block text-[11px] normal-case text-muted">{product.category}</span>
                  </th>
                ))}
                <th className="min-w-28 border-b border-r border-line bg-panel2 px-4 py-3">Total Qty</th>
                <th className="min-w-36 border-b border-r border-line bg-panel2 px-4 py-3">Order Amount</th>
                <th className="min-w-44 border-b border-r border-line bg-panel2 px-4 py-3">Previous Due Amount</th>
                <th className="min-w-36 border-b border-r border-line bg-panel2 px-4 py-3">Paid Amount</th>
                <th className="sticky right-0 z-40 min-w-32 border-b border-line bg-panel2 px-4 py-3">Today&apos;s Due Amount</th>
              </tr>
            </thead>
            <tbody>
              {visibleRoutes.map((route, index) => (
                <tr className={index % 2 ? "bg-panel2/30" : "bg-panel"} key={route.id}>
                  <td className={`sticky left-0 z-30 border-b border-r border-line px-4 py-3 text-left font-semibold text-ink shadow-[8px_0_12px_rgba(23,32,51,0.06)] ${index % 2 ? "bg-panel2" : "bg-panel"}`}>{route.routeName || "-"}</td>
                  <td className="border-b border-r border-line px-4 py-3 text-left font-semibold text-ink">{route.name}</td>
                  {visibleProducts.map((product) => {
                    const quantity = route.quantities[product.id] || 0;
                    return (
                      <td className={`border-b border-r border-line px-3 py-3 ${quantity ? "font-semibold text-ink" : "text-muted"}`} key={product.id}>
                        {formatQty(quantity) || "-"}
                      </td>
                    );
                  })}
                  <td className="border-b border-r border-line px-4 py-3 font-bold text-mint">{formatQty(routeTotal(route)) || "-"}</td>
                  <td className="border-b border-r border-line px-4 py-3 text-right font-semibold">{formatAmount(route.orderAmount)}</td>
                  <td className="border-b border-r border-line px-4 py-3 text-right font-semibold">{formatAmount(route.previousDue)}</td>
                  <td className="border-b border-r border-line px-4 py-3 text-right font-semibold">{formatAmount(route.paidAmount)}</td>
                  <td className={`sticky right-0 z-30 border-b border-line px-4 py-3 text-right font-bold text-berry shadow-[-8px_0_12px_rgba(23,32,51,0.06)] ${index % 2 ? "bg-panel2" : "bg-panel"}`}>{formatAmount(route.todaysDue)}</td>
                </tr>
              ))}
              {truckLoading && visibleProducts.length ? (
                <tr className="bg-mint/10 font-bold">
                  <td className="sticky left-0 z-30 border-b border-r border-line bg-[#e7f4f0] px-4 py-3 text-left shadow-[8px_0_12px_rgba(23,32,51,0.06)]">Product Total</td>
                  <td className="border-b border-r border-line px-4 py-3 text-left"></td>
                  {visibleProducts.map((product) => <td className="border-b border-r border-line px-3 py-3" key={product.id}>{formatQty(productTotals[product.id]) || "-"}</td>)}
                  <td className="border-b border-r border-line px-4 py-3 text-mint">{formatQty(totalQuantity) || "-"}</td>
                  <td className="border-b border-r border-line px-4 py-3 text-right">{formatAmount(amountTotals.orderAmount)}</td>
                  <td className="border-b border-r border-line px-4 py-3 text-right">{formatAmount(amountTotals.previousDue)}</td>
                  <td className="border-b border-r border-line px-4 py-3 text-right">{formatAmount(amountTotals.paidAmount)}</td>
                  <td className="sticky right-0 z-30 border-b border-line bg-[#e7f4f0] px-4 py-3 text-right text-berry shadow-[-8px_0_12px_rgba(23,32,51,0.06)]">{formatAmount(amountTotals.todaysDue)}</td>
                </tr>
              ) : null}
              {!loading && (!truckLoading || !visibleRoutes.length || !visibleProducts.length) ? (
                <tr>
                  <td className="px-4 py-10 text-center text-muted" colSpan={visibleProducts.length + 7}>No truck loading data for this date.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
