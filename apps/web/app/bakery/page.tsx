"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Boxes, CreditCard, IndianRupee, PackageSearch, RefreshCw, TrendingDown, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppShell } from "../../components/shell";
import { useToast } from "../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../lib/api";

type LowProductStock = {
  id: string;
  name: string;
  stockOnHand: number;
};

type OrderedWithoutStock = {
  productId: string;
  name: string;
  required: number;
  stockOnHand: number;
  shortage: number;
};

type DashboardData = {
  ordersDue: number;
  pendingPaymentsAmount: number;
  lowStock: number;
  customers: number;
  products: number;
  labour: { present: number; total: number };
  finance: {
    expenses: number;
    paidExpenses: number;
    pendingExpenses: number;
    rents: number;
    sellerPayments: number;
    customerPayments: number;
    rawMaterialExpenses: number;
  };
  stockMovement: {
    boughtQuantity: number;
    usedQuantity: number;
    boughtAmount: number;
  };
  salesChart: {
    total: number;
    orders: number;
    days: Array<{
      date: string;
      label: string;
      sales: number;
      orders: number;
    }>;
  };
  lowProductStocks: LowProductStock[];
  orderedWithoutStock: OrderedWithoutStock[];
};

function formatAmount(value?: number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatCompactAmount(value?: number | null) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

export default function BakeryPage() {
  const toast = useToast();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadDashboard() {
    if (!apiBase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await authFetch<DashboardData>(`${apiBase}/reports/dashboard`);
      setDashboard(data);
    } catch (error) {
      toast.error("Dashboard failed", error instanceof Error ? error.message : "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [apiBase]);

  const stats: Array<[string, string | number, LucideIcon]> = [
    ["Orders Due", dashboard?.ordersDue ?? 0, PackageSearch],
    ["Pending Payments", formatAmount(dashboard?.pendingPaymentsAmount || 0), CreditCard],
    ["Labour Present", `${dashboard?.labour.present ?? 0} / ${dashboard?.labour.total ?? 0}`, Users],
    ["Low Stock", dashboard?.lowStock ?? 0, AlertTriangle]
  ];
  const financeCards: Array<[string, string, LucideIcon]> = [
    ["Expenses", formatAmount(dashboard?.finance.expenses || 0), TrendingDown],
    ["Rents", formatAmount(dashboard?.finance.rents || 0), IndianRupee],
    ["Payment to sellers", formatAmount(dashboard?.finance.sellerPayments || 0), CreditCard],
    ["Customer payments", formatAmount(dashboard?.finance.customerPayments || 0), CreditCard],
    ["Raw material expense", formatAmount(dashboard?.finance.rawMaterialExpenses || 0), Boxes],
    ["Pending expenses", formatAmount(dashboard?.finance.pendingExpenses || 0), AlertTriangle]
  ];
  const maxSales = Math.max(...(dashboard?.salesChart.days.map((day) => day.sales) || [0]), 1);

  return (
    <AppShell title="Bakery CRM" subtitle="Orders, customers, stock, staff, routes, and reports">
      <div className="grid min-w-0 max-w-full gap-5">
        <section className="rounded-lg border border-line bg-sidebar p-5 text-white shadow-subtle">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-mint">Live Workspace</p>
              <h1 className="mt-2 text-2xl font-bold">Dashboard</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Month overview for expenses, seller payments, customer payments, and stock risks.
              </p>
            </div>
            <button
              className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/10 bg-white/10 text-white"
              onClick={loadDashboard}
              title="Refresh dashboard"
              type="button"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </section>

        <section className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(([label, value, Icon]) => (
            <div key={String(label)} className="min-w-0 rounded-lg border border-line bg-panel p-3 shadow-subtle sm:p-4">
              <div className="flex items-center justify-between">
                <p className="min-w-0 text-xs font-semibold uppercase leading-5 text-muted">{label as string}</p>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-mint/10 text-mint sm:h-9 sm:w-9">
                  <Icon size={18} />
                </span>
              </div>
              <p className="mt-4 break-words text-xl font-bold sm:text-2xl">{loading ? "..." : String(value)}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-mint">Sales Trend</p>
              <h2 className="mt-1 text-lg font-semibold">Day-by-day sales this month</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:text-right">
              <span className="rounded-md border border-line bg-panel2 px-3 py-2">
                <span className="block text-xs text-muted">Sales</span>
                <span className="font-semibold">{formatAmount(dashboard?.salesChart.total || 0)}</span>
              </span>
              <span className="rounded-md border border-line bg-panel2 px-3 py-2">
                <span className="block text-xs text-muted">Orders</span>
                <span className="font-semibold">{dashboard?.salesChart.orders || 0}</span>
              </span>
            </div>
          </div>
          <div className="w-full max-w-full overflow-x-auto px-3 py-4">
            <div className="flex min-h-56 min-w-max items-end gap-2">
              {(dashboard?.salesChart.days || []).map((day) => {
                const height = Math.max(day.sales ? (day.sales / maxSales) * 160 : 0, day.sales ? 10 : 3);
                return (
                  <div className="flex w-9 shrink-0 flex-col items-center gap-2" key={day.date} title={`${day.date}: ${formatAmount(day.sales)} · ${day.orders} orders`}>
                    <span className="h-5 text-[11px] font-semibold text-muted">{day.sales ? formatCompactAmount(day.sales) : ""}</span>
                    <div className="flex h-40 items-end">
                      <div
                        className={`w-7 rounded-t-md ${day.sales ? "bg-mint" : "bg-line"}`}
                        style={{ height: `${height}px` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-muted">{day.label}</span>
                  </div>
                );
              })}
              {loading ? <p className="p-4 text-sm text-muted">Loading sales chart...</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex items-center justify-between border-b border-line p-4">
            <div>
              <p className="text-sm font-semibold uppercase text-mint">This Month</p>
              <h2 className="mt-1 text-lg font-semibold">Money Overview</h2>
            </div>
            <span className="rounded-md border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold text-muted">Live API</span>
          </div>
          {loading ? <p className="p-4 text-sm text-muted">Loading dashboard...</p> : null}
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {financeCards.map(([label, value, Icon]) => (
              <article key={label} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-muted">{label}</p>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-panel text-mint">
                    <Icon size={17} />
                  </span>
                </div>
                <p className="mt-3 text-xl font-bold">{loading ? "..." : value}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-lg border border-line bg-panel shadow-subtle">
            <div className="border-b border-line p-4">
              <p className="text-sm font-semibold uppercase text-mint">Raw Materials</p>
              <h2 className="mt-1 text-lg font-semibold">Stock Movement This Month</h2>
            </div>
            <div className="grid gap-3 p-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                ["Bought", `${formatNumber(dashboard?.stockMovement.boughtQuantity || 0)} qty`],
                ["Used", `${formatNumber(dashboard?.stockMovement.usedQuantity || 0)} qty`],
                ["Buy value", formatAmount(dashboard?.stockMovement.boughtAmount || 0)]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-panel2 p-3">
                  <p className="text-xs font-semibold uppercase text-muted">{label}</p>
                  <p className="mt-2 text-xl font-bold">{loading ? "..." : value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-line bg-panel shadow-subtle">
            <div className="border-b border-line p-4">
              <p className="text-sm font-semibold uppercase text-mint">Stock Watch</p>
              <h2 className="mt-1 text-lg font-semibold">Products below 100 stock</h2>
            </div>
            <div className="grid gap-2 p-3">
              {dashboard?.lowProductStocks.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel2 p-3">
                  <span className="min-w-0 truncate font-semibold">{product.name}</span>
                  <span className="shrink-0 rounded-md border border-amber-400/40 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                    {formatNumber(product.stockOnHand)} left
                  </span>
                </div>
              ))}
              {!loading && !dashboard?.lowProductStocks.length ? (
                <p className="rounded-lg border border-line bg-panel2 p-4 text-sm text-muted">No product is below 100 stock.</p>
              ) : null}
            </div>
          </article>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="border-b border-line p-4">
            <p className="text-sm font-semibold uppercase text-mint">Order Risk</p>
            <h2 className="mt-1 text-lg font-semibold">Orders with no stock or shortage</h2>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            {dashboard?.orderedWithoutStock.map((item) => (
              <article key={item.productId} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate font-semibold">{item.name}</h3>
                  <span className="shrink-0 rounded-md border border-berry/30 bg-berry/10 px-2 py-1 text-xs font-semibold text-berry">
                    Short {formatNumber(item.shortage)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <span>
                    <span className="block text-xs text-muted">Orders need</span>
                    <span className="font-semibold">{formatNumber(item.required)}</span>
                  </span>
                  <span>
                    <span className="block text-xs text-muted">Stock</span>
                    <span className="font-semibold">{formatNumber(item.stockOnHand)}</span>
                  </span>
                </div>
              </article>
            ))}
            {!loading && !dashboard?.orderedWithoutStock.length ? (
              <p className="rounded-lg border border-line bg-panel2 p-4 text-sm text-muted">No order stock shortage found.</p>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
