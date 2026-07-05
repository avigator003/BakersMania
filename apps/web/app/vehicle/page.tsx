"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Route, Truck } from "lucide-react";
import Link from "next/link";
import { PaymentHistory, paymentDue, paymentTotal } from "../../components/payment-history";
import { AppShell } from "../../components/shell";
import { LoadingSpinner } from "../../components/loading-spinner";
import { useToast } from "../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../lib/api";

type Payment = { id: string; amount: string | number; method?: string | null; reference?: string | null; paidAt?: string | null };
type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  grandTotal: string | number;
  payments?: Payment[];
  createdAt: string;
  dueAt?: string | null;
  customer: { name: string; route?: { name: string } | null };
  route?: { name: string } | null;
};

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function orderPaid(order: Order) {
  return paymentTotal(order.payments);
}

function orderDue(order: Order) {
  return paymentDue(order.grandTotal, order.payments);
}

function routeName(order: Order) {
  return order.route?.name || order.customer.route?.name || "No route";
}

export default function VehicleOverviewPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: monthStart, endDate: today });
      const data = await authFetch<{ orders: Order[] }>(`${apiBase}/orders?${params.toString()}`);
      setOrders(data.orders);
    } catch (error) {
      toast.error("Could not load vehicle overview", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const delivered = orders.filter((order) => order.status === "COMPLETED").length;
    const notDelivered = orders.filter((order) => order.status !== "COMPLETED").length;
    const total = orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
    const paid = orders.reduce((sum, order) => sum + orderPaid(order), 0);
    const due = orders.reduce((sum, order) => sum + orderDue(order), 0);
    return { delivered, notDelivered, total, paid, due };
  }, [orders]);

  const routes = Array.from(new Set(orders.map(routeName))).sort();

  return (
    <AppShell title="Vehicle Workspace" subtitle="Monthly route and payment overview" surface="vehicle">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex items-center justify-between gap-3 border-b border-line p-4">
            <div>
              <h1 className="text-xl font-semibold">This Month</h1>
              <p className="mt-1 text-sm text-muted">Assigned routes from {monthStart} to {today}.</p>
            </div>
            <div className="hidden flex-wrap gap-x-4 gap-y-2 text-sm text-muted lg:flex">
              <span>Orders: <span className="font-semibold text-ink">{orders.length}</span></span>
              <span>Delivered: <span className="font-semibold text-ink">{stats.delivered}</span></span>
              <span>Pending: <span className="font-semibold text-ink">{stats.notDelivered}</span></span>
              <span>Collected: <span className="font-semibold text-ink">{formatAmount(stats.paid)}</span></span>
              <span>Due: <span className="font-semibold text-ink">{formatAmount(stats.due)}</span></span>
            </div>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button">
              <RefreshCw size={16} />
            </button>
          </div>
          {loading ? <LoadingSpinner label="Loading overview" /> : null}
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <Link className="focus-ring rounded-lg border border-line bg-panel2 p-4" href={`/${tenantSlug}/vehicle/routes`}>
              <Route className="text-mint" size={22} />
              <h2 className="mt-3 font-semibold">Today&apos;s Routes</h2>
              <p className="mt-1 text-sm text-muted">Mark delivery and payment status for assigned route orders.</p>
            </Link>
            <Link className="focus-ring rounded-lg border border-line bg-panel2 p-4" href={`/${tenantSlug}/vehicle/truck-loading`}>
              <Truck className="text-mint" size={22} />
              <h2 className="mt-3 font-semibold">Truck Loading</h2>
              <p className="mt-1 text-sm text-muted">View product quantities grouped for this vehicle&apos;s routes.</p>
            </Link>
          </div>
          <div className="border-t border-line p-4">
            <p className="text-sm font-semibold">Assigned route names</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {routes.map((route) => <span className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm" key={route}>{route}</span>)}
              {!routes.length && !loading ? <span className="text-sm text-muted">No assigned route orders this month.</span> : null}
            </div>
          </div>
          <div className="border-t border-line p-4">
            <p className="text-sm font-semibold">Recent Payment Collections</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {orders.filter((order) => order.payments?.length).slice(0, 6).map((order) => (
                <div className="rounded-lg border border-line bg-panel2 p-3" key={order.id}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-semibold">{order.customer.name}</span>
                    <span className="text-xs text-muted">{routeName(order)}</span>
                  </div>
                  <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                </div>
              ))}
              {!loading && !orders.some((order) => order.payments?.length) ? <span className="text-sm text-muted">No payment collections recorded this month.</span> : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
