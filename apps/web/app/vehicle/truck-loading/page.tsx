"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, clearSession, getStoredTenantSlug } from "../../../lib/api";
import { downloadXlsx, type XlsxColumn, type XlsxRow } from "../../../lib/xlsx-export";

type TruckLoading = {
  date: string;
  orderCount: number;
  statusCounts?: {
    accepted: number;
    pending: number;
  };
  products: { id: string; name: string; category: string; createdAt?: string }[];
  routes: {
    id: string;
    name: string;
    routeName?: string | null;
    createdAt?: string;
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
type OrderStatusFilter = "all" | "accepted" | "pending";
const today = localDateInput();
const orderStatusOptions = [
  { value: "all", label: "All orders" },
  { value: "accepted", label: "Accepted orders" },
  { value: "pending", label: "Pending orders" }
];

function formatQty(value?: string | number | null) {
  const amount = Number(value || 0);
  return amount ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount) : "";
}

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function roundAmount(value?: string | number | null) {
  return Math.round(Number(value || 0));
}

function formatExcelDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(Number(year), Number(month) - 1, Number(day)))
    : value;
}

function productHeaderName(name: string) {
  return name.trim().replace(/\s+/g, "\n");
}

export default function VehicleTruckLoadingPage() {
  const toast = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [truckLoading, setTruckLoading] = useState<TruckLoading | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const pathSegments = pathname.split("/").filter(Boolean);
  const pathTenantSlug = pathSegments.length > 1 && pathSegments[1] === "vehicle" ? pathSegments[0] : "";
  const tenantSlug = pathTenantSlug || (typeof window === "undefined" ? "" : getStoredTenantSlug() || "");
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ date, groupBy: "customer" });
      if (orderStatusFilter !== "all") params.set("orderStatus", orderStatusFilter);
      const data = await authFetch<{ truckLoading: TruckLoading }>(`${apiBase}/orders/truck-loading?${params.toString()}`);
      setTruckLoading(data.truckLoading);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please sign in again.";
      if (message === "Tenant access denied") {
        clearSession();
        toast.error("Please sign in again", "Your login belongs to another bakery.");
        router.replace(`/login/vehicle?next=${encodeURIComponent(pathname)}`);
        return;
      }
      toast.error("Could not load truck loading", message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date, orderStatusFilter]);

  const productOptions = useMemo(() => (truckLoading?.products || []).map((product) => ({
    value: product.id,
    label: product.name,
    description: product.category
  })), [truckLoading]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(new Set((truckLoading?.products || []).map((product) => product.category).filter(Boolean))).sort();
    return categories.map((category) => ({ value: category, label: category }));
  }, [truckLoading]);

  const customerOptions = useMemo(() => (truckLoading?.routes || []).map((route) => ({
    value: route.id,
    label: route.name,
    description: route.routeName || undefined
  })), [truckLoading]);

  const visibleProducts = useMemo(() => {
    const products = truckLoading?.products || [];
    return products.filter((product) => {
      const categoryMatches = !categoryFilter.length || categoryFilter.includes(product.category);
      const productMatches = !productFilter.length || productFilter.includes(product.id);
      return categoryMatches && productMatches;
    });
  }, [categoryFilter, productFilter, truckLoading]);

  const visibleRoutes = useMemo(() => {
    const routes = truckLoading?.routes || [];
    return customerFilter.length ? routes.filter((route) => customerFilter.includes(route.id)) : routes;
  }, [customerFilter, truckLoading]);

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
    orderAmount: visibleRoutes.reduce((sum, route) => sum + roundAmount(route.orderAmount), 0),
    previousDue: visibleRoutes.reduce((sum, route) => sum + roundAmount(route.previousDue), 0),
    paidAmount: visibleRoutes.reduce((sum, route) => sum + roundAmount(route.paidAmount), 0),
    todaysDue: visibleRoutes.reduce((sum, route) => sum + roundAmount(route.todaysDue), 0)
  }), [visibleRoutes]);

  function exportTruckLoading() {
    if (!truckLoading) return;
    const candidateProducts = visibleProducts.length ? visibleProducts : truckLoading.products;
    const exportProducts = candidateProducts.filter((product) => (
      visibleRoutes.reduce((sum, route) => sum + Number(route.quantities[product.id] || 0), 0) >= 1
    ));
    const selectedCategories = categoryFilter.length ? categoryFilter.join(", ") : "All categories";
    const selectedRoutes = Array.from(new Set(visibleRoutes.map((route) => route.routeName).filter(Boolean))).join(", ") || "All routes";
    const exportProductTotals = Object.fromEntries(exportProducts.map((product) => [
      product.id,
      visibleRoutes.reduce((sum, route) => sum + Number(route.quantities[product.id] || 0), 0)
    ]));
    const exportTotalQuantity = visibleRoutes.reduce((sum, route) => (
      sum + exportProducts.reduce((routeSum, product) => routeSum + Number(route.quantities[product.id] || 0), 0)
    ), 0);
    const columns: XlsxColumn[] = [
      { width: 16 },
      ...exportProducts.map(() => ({ width: 4 })),
      { width: 7 },
      { width: 9 },
      { width: 7 },
      { width: 9 }
    ];
    const rows: XlsxRow[] = [
      {
        height: 18,
        cells: [
          { value: `Date: ${formatExcelDate(truckLoading.date)} | Route: ${selectedRoutes} | Category: ${selectedCategories} | Quantity: ${formatQty(exportTotalQuantity) || "0"}`, style: "metaValue", colSpan: Math.max(columns.length, 1) }
        ]
      },
      { height: 12, cells: [] },
      {
        height: 54,
        cells: [
          { value: "Customer", style: "header" },
          ...exportProducts.map((product) => ({ value: productHeaderName(product.name), style: "header" as const })),
          { value: "Order", style: "header" },
          { value: "Previous", style: "header" },
          { value: "Paid", style: "header" },
          { value: "Today Due", style: "header" }
        ]
      },
      ...visibleRoutes.map((route) => {
        return {
          height: 24,
          cells: [
            { value: route.name, style: "name" as const },
            ...exportProducts.map((product) => ({ value: route.quantities[product.id] || null })),
            { value: roundAmount(route.orderAmount) || null, style: "amount" as const },
            { value: roundAmount(route.previousDue) || null, style: "amount" as const },
            { value: roundAmount(route.paidAmount) || null, style: "amount" as const },
            { value: roundAmount(route.todaysDue) || null, style: "amount" as const }
          ]
        };
      }),
      {
        height: 24,
        cells: [
          { value: "Product Total", style: "summary" },
          ...exportProducts.map((product) => ({ value: exportProductTotals[product.id] || null, style: "summary" as const })),
          { value: amountTotals.orderAmount || null, style: "summary" },
          { value: amountTotals.previousDue || null, style: "summary" },
          { value: amountTotals.paidAmount || null, style: "summary" },
          { value: amountTotals.todaysDue || null, style: "summary" }
        ]
      }
    ];
    downloadXlsx(`vehicle-truck-loading-${truckLoading.date}.xlsx`, rows, columns);
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
              <span>Date: <span className="font-semibold text-ink">{formatDisplayDate(date)}</span></span>
              <span>Products: <span className="font-semibold text-ink">{visibleProducts.length}</span></span>
              <span>Orders: <span className="font-semibold text-ink">{truckLoading?.orderCount || 0}</span></span>
              <span>Accepted: <span className="font-semibold text-mint">{truckLoading?.statusCounts?.accepted || 0}</span></span>
              <span>Pending: <span className="font-semibold text-saffron">{truckLoading?.statusCounts?.pending || 0}</span></span>
              <span>Qty: <span className="font-semibold text-ink">{formatQty(totalQuantity) || "0"}</span></span>
              <span>Today&apos;s Due Amount: <span className="font-semibold text-ink">{formatAmount(amountTotals.todaysDue)}</span></span>
            </div>
            <SearchableSelect
              className="min-w-52"
              onChange={(value) => setOrderStatusFilter((value || "all") as OrderStatusFilter)}
              options={orderStatusOptions}
              placeholder="All orders"
              searchPlaceholder="Search status"
              value={orderStatusFilter}
            />
            <SearchableSelect className="min-w-56" multiple onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={categoryFilter} />
            <SearchableSelect className="min-w-56" multiple onChange={setProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={productFilter} />
            <SearchableSelect className="min-w-52" multiple onChange={setCustomerFilter} options={customerOptions} placeholder="All customers" searchPlaceholder="Search customers" value={customerFilter} />
            <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={setDate} value={date} />
            <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" disabled={!visibleProducts.length} onClick={exportTruckLoading} type="button"><Download size={16} /> Export</button>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
          </div>
        </div>

        {loading ? <LoadingSpinner label="Loading truck sheet" /> : null}

        <div className="max-h-[700px] w-full max-w-full overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-center text-sm">
            <thead className="sticky top-0 z-20 text-xs uppercase text-muted">
              <tr>
                <th className="sticky left-0 z-40 min-w-52 border-b border-r border-line bg-panel2 px-4 py-3 text-left shadow-[8px_0_12px_rgba(23,32,51,0.08)]">Customer / Route</th>
                {visibleProducts.map((product) => (
                  <th className="min-w-28 border-b border-r border-line bg-panel2 px-3 py-3" key={product.id}>
                    <span className="block text-ink">{product.name}</span>
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
                  <td className={`sticky left-0 z-30 border-b border-r border-line px-4 py-3 text-left font-semibold text-ink shadow-[8px_0_12px_rgba(23,32,51,0.06)] ${index % 2 ? "bg-panel2" : "bg-panel"}`}>
                    <span className="block">{route.name}</span>
                    {route.routeName ? <span className="mt-0.5 block text-xs font-medium text-muted">{route.routeName}</span> : null}
                  </td>
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
                  <td className="px-4 py-10 text-center text-muted" colSpan={visibleProducts.length + 6}>{visibleProducts.length ? "No customer orders for this date." : "No products found."}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
