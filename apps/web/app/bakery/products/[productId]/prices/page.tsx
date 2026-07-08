"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { IndianRupee, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "../../../../../components/shell";
import { LoadingSpinner } from "../../../../../components/loading-spinner";
import { PaginationControls } from "../../../../../components/pagination";
import { SearchableSelect } from "../../../../../components/searchable-select";
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

type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type PricingTab = "assign" | "assigned";

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
  const [routeFilter, setRouteFilter] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<PricingTab>("assign");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(25);
  const [historyPageCount, setHistoryPageCount] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const routes = useMemo(() => {
    const routeMap = new Map<string, string>();
    customers.forEach((customer) => {
      if (customer.route) routeMap.set(customer.route.id, customer.route.name);
    });
    return Array.from(routeMap.entries()).map(([id, name]) => ({ id, name }));
  }, [customers]);

  const routeOptions = useMemo(() => routes.map((route) => ({ value: route.id, label: route.name })), [routes]);

  const validRows = useMemo(() => {
    return priceRows.filter((row) => Number(row.price) > 0 && row.customerIds.length);
  }, [priceRows]);

  const assignedCustomerIds = useMemo(() => new Set((product?.customerPrices || []).map((price) => price.customer.id)), [product]);

  const selectedDraftCustomerIds = useMemo(() => new Set(priceRows.flatMap((row) => row.customerIds)), [priceRows]);

  const allCustomerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: customer.id,
        label: customer.name,
        description: [customer.phone, customer.city, customer.route?.name || "No route"].filter(Boolean).join(" · ")
      })),
    [customers]
  );

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
        authFetch<{ customers: Customer[] }>(`${apiBase}/customers?pageSize=100`)
      ]);
      const historyData = await authFetch<{ history: PriceHistory[]; pagination?: PaginationMeta }>(`${apiBase}/catalog/products/${params.productId}/price-history?page=${historyPage}&pageSize=${historyPageSize}`);
      setProduct(productData.product);
      setCustomers(customerData.customers);
      setHistory(historyData.history);
      setHistoryTotal(historyData.pagination?.total ?? historyData.history.length);
      setHistoryPageCount(historyData.pagination?.pageCount ?? 1);
      setHistoryPage(historyData.pagination?.page ?? historyPage);
      setHistoryPageSize(historyData.pagination?.pageSize ?? historyPageSize);
    } catch (error) {
      toast.error("Could not load price assignment", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [historyPage, historyPageSize]);

  function addRow() {
    setPriceRows((current) => [...current, { id: `row-${Date.now()}`, price: "", customerIds: [] }]);
  }

  function removeRow(rowId: string) {
    setPriceRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== rowId)));
  }

  function updateRow(rowId: string, patch: Partial<PriceRow>) {
    setPriceRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function customerOptionsForRow(row: PriceRow) {
    return customers
      .filter((customer) => {
        const matchesRoute = !routeFilter.length || (customer.route?.id && routeFilter.includes(customer.route.id));
        return matchesRoute && !selectedDraftCustomerIds.has(customer.id) && !assignedCustomerIds.has(customer.id);
      })
      .map((customer) => ({
        value: customer.id,
        label: customer.name,
        description: [customer.phone, customer.city, customer.route?.name || "No route"].filter(Boolean).join(" · ")
      }));
  }

  function selectedCustomerOptionsForRow(row: PriceRow) {
    return allCustomerOptions.filter((option) => row.customerIds.includes(option.value));
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
      setActiveTab("assigned");
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
          <div className="flex gap-2 border-b border-line p-3">
            {[
              ["assign", "Assign Pricing"],
              ["assigned", "Assigned Pricing"]
            ].map(([value, label]) => (
              <button
                className={`focus-ring rounded-md px-4 py-2 text-sm font-semibold ${activeTab === value ? "bg-mint text-white" : "border border-line bg-panel2 text-muted"}`}
                key={value}
                onClick={() => setActiveTab(value as PricingTab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "assign" ? (
            <>
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-semibold text-muted">Add one row per price, then search and attach customers to that row.</p>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={addRow} type="button">
                <Plus size={16} />
                Add Row
              </button>
              <SearchableSelect multiple onChange={setRouteFilter} options={routeOptions} placeholder="All routes" searchPlaceholder="Search routes" value={routeFilter} />
            </div>
          </div>

          {loading ? <LoadingSpinner label="Loading customers" /> : null}

          <div className="grid gap-3 p-3 sm:hidden">
            {priceRows.map((row, index) => {
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
                  <SearchableSelect
                    className="mt-3"
                    multiple
                    onChange={(customerIds) => updateRow(row.id, { customerIds })}
                    options={customerOptionsForRow(row)}
                    placeholder="Select customers"
                    searchPlaceholder="Search customers"
                    selectedOptions={selectedCustomerOptionsForRow(row)}
                    value={row.customerIds}
                  />
                </article>
              );
            })}
          </div>

          <div className="hidden p-3 sm:grid sm:gap-3">
            <div className="grid grid-cols-[180px_minmax(0,1fr)_56px] items-center gap-3 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold uppercase text-muted">
              <span>Price</span>
              <span>Customers</span>
              <span className="text-right">Action</span>
            </div>
            {priceRows.map((row, index) => (
              <div className="grid grid-cols-[180px_minmax(0,1fr)_56px] items-start gap-3 rounded-md border border-line bg-panel2 p-3" key={row.id}>
                <label className="grid gap-1">
                  <span className="sr-only">Row {index + 1} price</span>
                  <input
                    className="h-10 w-full rounded-md border border-line bg-panel px-3 text-sm outline-none focus:border-mint"
                    onChange={(event) => updateRow(row.id, { price: event.target.value })}
                    placeholder="0"
                    type="number"
                    value={row.price}
                  />
                </label>
                <SearchableSelect
                  multiple
                  onChange={(customerIds) => updateRow(row.id, { customerIds })}
                  options={customerOptionsForRow(row)}
                  placeholder="Select customers"
                  searchPlaceholder="Search customers"
                  selectedOptions={selectedCustomerOptionsForRow(row)}
                  value={row.customerIds}
                />
                <button
                  className="focus-ring inline-grid h-10 w-10 place-items-center justify-self-end rounded-md border border-line bg-panel"
                  disabled={priceRows.length === 1}
                  onClick={() => removeRow(row.id)}
                  title="Remove row"
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-mint">Assigned Pricing</p>
                  <h2 className="mt-1 text-lg font-semibold">{product?.customerPrices.length || 0} customer prices</h2>
                </div>
                <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh assigned prices" type="button">
                  <RefreshCw size={16} />
                </button>
              </div>
              {loading ? <LoadingSpinner label="Loading assigned prices" /> : null}
              <div className="grid gap-3 p-3 sm:hidden">
                {(product?.customerPrices || []).map((price) => (
                  <article className="rounded-lg border border-line bg-panel2 p-3" key={price.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{price.customer.name}</h3>
                        <p className="text-xs text-muted">{price.customer.route?.name || "No route"} · {price.customer.phone || "No phone"}</p>
                      </div>
                      <span className="shrink-0 font-semibold text-mint">{formatAmount(price.price)}</span>
                    </div>
                    {price.notes ? <p className="mt-2 text-xs text-muted">{price.notes}</p> : null}
                  </article>
                ))}
                {!product?.customerPrices.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No assigned prices yet.</p> : null}
              </div>
              <div className="hidden max-h-[420px] w-full max-w-full overflow-auto sm:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3 text-right">Assigned Price</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(product?.customerPrices || []).map((price) => (
                      <tr key={price.id}>
                        <td className="px-4 py-3 font-semibold">{price.customer.name}</td>
                        <td className="px-4 py-3 text-muted">{price.customer.route?.name || "No route"}</td>
                        <td className="px-4 py-3 text-muted">{price.customer.phone || "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-mint">{formatAmount(price.price)}</td>
                        <td className="px-4 py-3 text-muted">{price.notes || "-"}</td>
                      </tr>
                    ))}
                    {!product?.customerPrices.length ? <tr><td className="px-4 py-8 text-center text-muted" colSpan={5}>No assigned prices yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {activeTab === "assigned" ? (
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="border-b border-line p-4">
            <p className="text-sm font-semibold uppercase text-mint">Price History</p>
            <h2 className="mt-1 text-lg font-semibold">Recent customer price changes</h2>
          </div>
          <PaginationControls page={historyPage} pageCount={historyPageCount} pageSize={historyPageSize} setPage={setHistoryPage} setPageSize={setHistoryPageSize} total={historyTotal} />
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
        ) : null}
      </div>
    </AppShell>
  );
}
