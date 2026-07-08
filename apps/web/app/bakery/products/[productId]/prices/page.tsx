"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { IndianRupee, RefreshCw } from "lucide-react";
import { AppShell } from "../../../../../components/shell";
import { LoadingSpinner } from "../../../../../components/loading-spinner";
import { useToast } from "../../../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../../../lib/api";

type Route = {
  id: string;
  name: string;
  vehicle?: { name: string; driverName?: string | null } | null;
};

type RoutePrice = {
  id: string;
  price: string;
  notes?: string | null;
  route: Route;
};

type Product = {
  id: string;
  name: string;
  category: string;
  unitPrice: string;
  routePrices: RoutePrice[];
};

type RoutePriceRow = {
  routeId: string;
  price: string;
  notes: string;
};

function formatAmount(value?: string | number | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function ProductRoutePricingPage() {
  const toast = useToast();
  const params = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routePriceRows, setRoutePriceRows] = useState<RoutePriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const validRouteRows = useMemo(() => routePriceRows.filter((row) => Number(row.price) > 0), [routePriceRows]);

  async function loadData() {
    if (!apiBase || !params.productId) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [productData, routeData] = await Promise.all([
        authFetch<{ product: Product }>(`${apiBase}/catalog/products/${params.productId}`),
        authFetch<{ routes: Route[] }>(`${apiBase}/routes?pageSize=100`)
      ]);
      setProduct(productData.product);
      setRoutes(routeData.routes);
    } catch (error) {
      toast.error("Could not load route pricing", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!product || !routes.length) return;
    setRoutePriceRows(
      routes.map((route) => {
        const existing = product.routePrices?.find((price) => price.route.id === route.id);
        return {
          routeId: route.id,
          price: existing ? String(existing.price) : "",
          notes: existing?.notes || ""
        };
      })
    );
  }, [product, routes]);

  function updateRoutePriceRow(routeId: string, patch: Partial<RoutePriceRow>) {
    setRoutePriceRows((current) => current.map((row) => (row.routeId === routeId ? { ...row, ...patch } : row)));
  }

  async function saveRoutePrices() {
    if (!apiBase || !product) return;
    if (!validRouteRows.length) {
      toast.warning("No route prices", "Enter a price for at least one route.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        validRouteRows.map((row) =>
          authFetch(`${apiBase}/catalog/route-prices`, {
            method: "POST",
            body: JSON.stringify({
              productId: product.id,
              routeId: row.routeId,
              price: Number(row.price),
              notes: row.notes || undefined
            })
          })
        )
      );
      toast.success("Route prices saved", `${validRouteRows.length} route price${validRouteRows.length === 1 ? "" : "s"} updated.`);
      await loadData();
    } catch (error) {
      toast.error("Route price save failed", error instanceof Error ? error.message : "Could not save route prices.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Product route price assignment" surface="bakery">
      <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-6">
        <section className="shrink-0 rounded-lg border border-line bg-panel p-5 shadow-subtle">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-mint">Set Route Prices</p>
              <h1 className="mt-2 text-2xl font-bold">{product?.name || "Product"}</h1>
              <p className="mt-2 text-sm text-muted">
                Base price {formatAmount(product?.unitPrice)} · Route prices {product?.routePrices.length || 0}
              </p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-end">
              <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh prices" type="button">
                <RefreshCw size={16} />
              </button>
              <button
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 font-semibold text-white"
                disabled={saving || !validRouteRows.length}
                onClick={saveRoutePrices}
                type="button"
              >
                <IndianRupee size={16} />
                {saving ? "Saving..." : "Save Route Prices"}
              </button>
            </div>
          </div>
        </section>

        <section className="flex min-h-[520px] flex-1 flex-col rounded-lg border border-line bg-panel shadow-subtle">
          <div className="shrink-0 flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-mint">Route Pricing</p>
              <h2 className="mt-1 text-lg font-semibold">Set one product price for every customer on a route</h2>
            </div>
            <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh route prices" type="button">
              <RefreshCw size={16} />
            </button>
          </div>
          {loading ? <LoadingSpinner label="Loading route prices" /> : null}
          <div className="grid gap-3 p-3 sm:hidden">
            {routePriceRows.map((row) => {
              const route = routes.find((item) => item.id === row.routeId);
              const existing = product?.routePrices.find((price) => price.route.id === row.routeId);
              return (
                <article className="rounded-lg border border-line bg-panel2 p-3" key={row.routeId}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{route?.name || "Route"}</h3>
                      <p className="text-xs text-muted">
                        {route?.vehicle?.name || "No vehicle"} · Current: {existing ? formatAmount(existing.price) : formatAmount(product?.unitPrice)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <input
                      className="h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-mint"
                      onChange={(event) => updateRoutePriceRow(row.routeId, { price: event.target.value })}
                      placeholder="Route price"
                      type="number"
                      value={row.price}
                    />
                    <input
                      className="h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-mint"
                      onChange={(event) => updateRoutePriceRow(row.routeId, { notes: event.target.value })}
                      placeholder="Notes"
                      value={row.notes}
                    />
                  </div>
                </article>
              );
            })}
            {!loading && !routePriceRows.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No routes found.</p> : null}
          </div>
          <div className="hidden min-h-0 flex-1 w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3 text-right">Current Price</th>
                  <th className="px-4 py-3">New Route Price</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {routePriceRows.map((row) => {
                  const routePrice = product?.routePrices.find((price) => price.route.id === row.routeId);
                  const route = routePrice?.route || routes.find((item) => item.id === row.routeId);
                  return (
                    <tr key={row.routeId}>
                      <td className="px-4 py-3 font-semibold">{route?.name || "Route"}</td>
                      <td className="px-4 py-3 text-muted">{routePrice?.route.vehicle?.name || route?.vehicle?.name || "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{routePrice ? formatAmount(routePrice.price) : formatAmount(product?.unitPrice)}</td>
                      <td className="px-4 py-3">
                        <input
                          className="h-10 w-36 rounded-md border border-line bg-panel2 px-3 text-sm outline-none focus:border-mint"
                          onChange={(event) => updateRoutePriceRow(row.routeId, { price: event.target.value })}
                          placeholder="0"
                          type="number"
                          value={row.price}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="h-10 w-full rounded-md border border-line bg-panel2 px-3 text-sm outline-none focus:border-mint"
                          onChange={(event) => updateRoutePriceRow(row.routeId, { notes: event.target.value })}
                          placeholder="Optional notes"
                          value={row.notes}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!loading && !routePriceRows.length ? <tr><td className="px-4 py-8 text-center text-muted" colSpan={5}>No routes found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
