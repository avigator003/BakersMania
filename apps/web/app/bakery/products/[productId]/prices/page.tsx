"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { IndianRupee, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { AppShell } from "../../../../../components/shell";
import { useToast } from "../../../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../../../lib/api";

type Route = {
  id: string;
  name: string;
};

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  route?: Route | null;
};

type CustomerPrice = {
  id: string;
  price: string;
  notes?: string | null;
  customer: Customer;
};
type PriceHistory = {
  id: string;
  oldPrice?: string | number | null;
  newPrice: string | number;
  changedAt: string;
  customer: Customer;
};

type Product = {
  id: string;
  name: string;
  category: string;
  unitPrice: string;
  customerPrices: CustomerPrice[];
};

type PriceRow = {
  id: string;
  price: string;
  customerIds: string[];
};

function formatAmount(value?: string | number | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function ProductPriceAssignmentPage() {
  const toast = useToast();
  const params = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([{ id: "row-1", price: "", customerIds: [] }]);
  const [rowSearches, setRowSearches] = useState<Record<string, string>>({});
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [routeFilter, setRouteFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const priceByCustomerId = useMemo(() => {
    return Object.fromEntries((product?.customerPrices || []).map((item) => [item.customer.id, item]));
  }, [product]);

  const routes = useMemo(() => {
    const routeMap = new Map<string, string>();
    customers.forEach((customer) => {
      if (customer.route) routeMap.set(customer.route.id, customer.route.name);
    });
    return Array.from(routeMap.entries()).map(([id, name]) => ({ id, name }));
  }, [customers]);

  const customerById = useMemo(() => {
    return Object.fromEntries(customers.map((customer) => [customer.id, customer]));
  }, [customers]);

  const validRows = useMemo(() => {
    return priceRows.filter((row) => Number(row.price) > 0 && row.customerIds.length);
  }, [priceRows]);

  async function loadData() {
    if (!apiBase || !params.productId) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [productData, customerData] = await Promise.all([
        authFetch<{ product: Product }>(`${apiBase}/catalog/products/${params.productId}`),
        authFetch<{ customers: Customer[] }>(`${apiBase}/customers`)
      ]);
      const historyData = await authFetch<{ history: PriceHistory[] }>(`${apiBase}/catalog/products/${params.productId}/price-history`);
      setProduct(productData.product);
      setCustomers(customerData.customers);
      setHistory(historyData.history);
    } catch (error) {
      toast.error("Could not load price assignment", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function addRow() {
    setPriceRows((current) => [...current, { id: `row-${Date.now()}`, price: "", customerIds: [] }]);
  }

  function removeRow(rowId: string) {
    setPriceRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== rowId)));
    setRowSearches((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    if (openRowId === rowId) setOpenRowId(null);
  }

  function updateRow(rowId: string, patch: Partial<PriceRow>) {
    setPriceRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function addRowCustomer(rowId: string, customerId: string) {
    setPriceRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        if (row.customerIds.includes(customerId)) return row;
        return { ...row, customerIds: [...row.customerIds, customerId] };
      })
    );
    setRowSearches((current) => ({ ...current, [rowId]: "" }));
    setOpenRowId(null);
  }

  function removeRowCustomer(rowId: string, customerId: string) {
    setPriceRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, customerIds: row.customerIds.filter((id) => id !== customerId) } : row))
    );
  }

  function customersForRow(row: PriceRow) {
    const selectedInOtherRows = new Set(
      priceRows
        .filter((item) => item.id !== row.id)
        .flatMap((item) => item.customerIds)
    );
    const query = (rowSearches[row.id] || "").trim().toLowerCase();
    return customers
      .filter((customer) => {
        const matchesRoute = routeFilter === "all" || customer.route?.id === routeFilter;
        const matchesSearch =
          !query ||
          [customer.name, customer.phone, customer.city, customer.route?.name]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        return matchesRoute && matchesSearch && !row.customerIds.includes(customer.id) && !selectedInOtherRows.has(customer.id);
      })
      .slice(0, 8);
  }

  async function savePrices() {
    if (!apiBase || !product) return;
    if (!validRows.length) {
      toast.warning("No valid price rows", "Add a price and select customers in at least one row.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        validRows.flatMap((row) =>
          row.customerIds.map((customerId) =>
            authFetch(`${apiBase}/catalog/customer-prices`, {
              method: "POST",
              body: JSON.stringify({
                productId: product.id,
                customerId,
                price: Number(row.price)
              })
            })
          )
        )
      );
      const savedCount = validRows.reduce((count, row) => count + row.customerIds.length, 0);
      toast.success("Prices saved", `${savedCount} customer price${savedCount === 1 ? "" : "s"} updated across ${validRows.length} row${validRows.length === 1 ? "" : "s"}.`);
      setPriceRows([{ id: "row-1", price: "", customerIds: [] }]);
      await loadData();
    } catch (error) {
      toast.error("Price save failed", error instanceof Error ? error.message : "Could not save customer prices.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Bulk customer price assignment" surface="bakery">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel p-5 shadow-subtle">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-mint">Set Customer Prices</p>
              <h1 className="mt-2 text-2xl font-bold">{product?.name || "Product"}</h1>
              <p className="mt-2 text-sm text-muted">
                Base price {formatAmount(product?.unitPrice)} · Existing customer prices {product?.customerPrices.length || 0}
              </p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-end">
              <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh prices">
                <RefreshCw size={16} />
              </button>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving || !validRows.length} onClick={savePrices}>
                <IndianRupee size={16} />
                {saving ? "Saving..." : "Save Prices"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-semibold text-muted">Add one row per price, then search and attach customers to that row.</p>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={addRow} type="button">
                <Plus size={16} />
                Add Row
              </button>
              <select
                className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint"
                onChange={(event) => setRouteFilter(event.target.value)}
                value={routeFilter}
              >
                <option value="all">All routes</option>
                {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
              </select>
            </div>
          </div>

          {loading ? <p className="p-4 text-sm text-muted">Loading customers...</p> : null}

          <div className="grid gap-3 p-3 sm:hidden">
            {priceRows.map((row, index) => {
              const rowCustomers = customersForRow(row);
              return (
                <article key={row.id} className="rounded-lg border border-line bg-panel2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="grid min-w-0 flex-1 gap-1 text-sm font-semibold">
                      Row {index + 1} price
                      <input
                        className="h-10 rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-mint"
                        onChange={(event) => updateRow(row.id, { price: event.target.value })}
                        placeholder="0"
                        type="number"
                        value={row.price}
                      />
                    </label>
                    <button
                      className="focus-ring mt-6 grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-panel"
                      disabled={priceRows.length === 1}
                      onClick={() => removeRow(row.id)}
                      title="Remove row"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-3 flex min-h-10 flex-wrap gap-2">
                    {row.customerIds.map((customerId) => {
                      const customer = customerById[customerId];
                      if (!customer) return null;
                      return (
                        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold" key={customerId}>
                          <span>{customer.name}</span>
                          <span className="text-muted">({customer.route?.name || "No route"})</span>
                          <button
                            className="focus-ring grid h-5 w-5 place-items-center rounded-full hover:bg-berry/10 hover:text-berry"
                            onClick={() => removeRowCustomer(row.id, customerId)}
                            title={`Remove ${customer.name}`}
                            type="button"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                    {!row.customerIds.length ? <span className="text-sm text-muted">No customers selected</span> : null}
                  </div>
                  <div className="mt-3">
                    <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-panel px-3">
                      <Search size={15} className="text-muted" />
                      <input
                        className="w-full bg-transparent text-sm outline-none"
                        onChange={(event) => {
                          setRowSearches((current) => ({ ...current, [row.id]: event.target.value }));
                          setOpenRowId(row.id);
                        }}
                        onFocus={() => setOpenRowId(row.id)}
                        placeholder="Search customer"
                        value={rowSearches[row.id] || ""}
                      />
                    </label>
                    {openRowId === row.id ? (
                      <div className="mt-2 max-h-64 w-full max-w-full overflow-auto rounded-md border border-line bg-panel shadow-subtle">
                        {rowCustomers.map((customer) => {
                          const existingPrice = priceByCustomerId[customer.id];
                          return (
                            <button
                              className="grid w-full grid-cols-[1fr_auto] gap-3 px-3 py-2 text-left text-sm hover:bg-panel2"
                              key={customer.id}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => addRowCustomer(row.id, customer.id)}
                              type="button"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">{customer.name}</span>
                                <span className="block truncate text-xs text-muted">{customer.route?.name || "No route"}</span>
                              </span>
                              {existingPrice ? <span className="text-xs font-semibold text-mint">{formatAmount(existingPrice.price)}</span> : null}
                            </button>
                          );
                        })}
                        {!rowCustomers.length ? <p className="px-3 py-2 text-sm text-muted">No available customers</p> : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden w-full max-w-full overflow-x-auto sm:block">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Assigned customers</th>
                  <th className="px-4 py-3 font-semibold">Add customer</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {priceRows.map((row, index) => {
                  const rowCustomers = customersForRow(row);
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="w-44 px-4 py-3">
                        <label className="sr-only">Row {index + 1} price</label>
                        <input
                          className="h-10 w-36 rounded-md border border-line bg-panel2 px-3 text-sm outline-none focus:border-mint"
                          onChange={(event) => updateRow(row.id, { price: event.target.value })}
                          placeholder="0"
                          type="number"
                          value={row.price}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-h-10 flex-wrap gap-2">
                          {row.customerIds.map((customerId) => {
                            const customer = customerById[customerId];
                            if (!customer) return null;
                            return (
                              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel2 px-3 py-1 text-xs font-semibold" key={customerId}>
                                <span>{customer.name}</span>
                                <span className="text-muted">({customer.route?.name || "No route"})</span>
                                <button
                                  className="focus-ring grid h-5 w-5 place-items-center rounded-full hover:bg-berry/10 hover:text-berry"
                                  onClick={() => removeRowCustomer(row.id, customerId)}
                                  title={`Remove ${customer.name}`}
                                  type="button"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                          {!row.customerIds.length ? <span className="pt-2 text-sm text-muted">No customers selected</span> : null}
                        </div>
                      </td>
                      <td className="w-[340px] px-4 py-3">
                        <div>
                          <label className="flex h-10 items-center gap-2 rounded-md border border-line bg-panel2 px-3">
                            <Search size={15} className="text-muted" />
                            <input
                              className="w-full bg-transparent text-sm outline-none"
                              onChange={(event) => {
                                setRowSearches((current) => ({ ...current, [row.id]: event.target.value }));
                                setOpenRowId(row.id);
                              }}
                              onFocus={() => setOpenRowId(row.id)}
                              placeholder="Search customer"
                              value={rowSearches[row.id] || ""}
                            />
                          </label>
                          {openRowId === row.id ? (
                            <div className="mt-2 max-h-64 w-full max-w-full overflow-auto rounded-md border border-line bg-panel shadow-subtle">
                              {rowCustomers.map((customer) => {
                                const existingPrice = priceByCustomerId[customer.id];
                                return (
                                  <button
                                    className="grid w-full grid-cols-[1fr_auto] gap-3 px-3 py-2 text-left text-sm hover:bg-panel2"
                                    key={customer.id}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => addRowCustomer(row.id, customer.id)}
                                    type="button"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate font-semibold">{customer.name}</span>
                                      <span className="block truncate text-xs text-muted">{customer.route?.name || "No route"}</span>
                                    </span>
                                    {existingPrice ? <span className="text-xs font-semibold text-mint">{formatAmount(existingPrice.price)}</span> : null}
                                  </button>
                                );
                              })}
                              {!rowCustomers.length ? <p className="px-3 py-2 text-sm text-muted">No available customers</p> : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="focus-ring inline-grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2"
                          disabled={priceRows.length === 1}
                          onClick={() => removeRow(row.id)}
                          title="Remove row"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="border-b border-line p-4">
            <p className="text-sm font-semibold uppercase text-mint">Price History</p>
            <h2 className="mt-1 text-lg font-semibold">Recent customer price changes</h2>
          </div>
          <div className="grid gap-3 p-3 sm:hidden">
            {history.map((item) => (
              <article key={item.id} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{item.customer.name}</h3>
                    <p className="text-xs text-muted">{item.customer.route?.name || "No route"}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-mint">{formatAmount(item.newPrice)}</span>
                </div>
                <p className="mt-3 rounded-md bg-panel px-3 py-2 text-xs text-muted">
                  Old: {item.oldPrice === null || item.oldPrice === undefined ? "-" : formatAmount(item.oldPrice)} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.changedAt))}
                </p>
              </article>
            ))}
            {!history.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No price history yet.</p> : null}
          </div>
          <div className="hidden max-h-[360px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3 text-right">Old Price</th>
                  <th className="px-4 py-3 text-right">New Price</th>
                  <th className="px-4 py-3">Changed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold">{item.customer.name}</td>
                    <td className="px-4 py-3 text-muted">{item.customer.route?.name || "No route"}</td>
                    <td className="px-4 py-3 text-right">{item.oldPrice === null || item.oldPrice === undefined ? "-" : formatAmount(item.oldPrice)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAmount(item.newPrice)}</td>
                    <td className="px-4 py-3">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(item.changedAt))}</td>
                  </tr>
                ))}
                {!history.length ? <tr><td className="px-4 py-8 text-center text-muted" colSpan={5}>No price history yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
