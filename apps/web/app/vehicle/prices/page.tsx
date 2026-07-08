"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { IndianRupee, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Order = {
  id: string;
  customerId: string;
  customer: { id?: string; name: string; phone?: string | null; route?: { name: string } | null };
  route?: { name: string } | null;
};

type Product = {
  id: string;
  name: string;
  unitPrice: string | number;
  category?: string | null;
};

const today = new Date().toISOString().slice(0, 10);

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function VehiclePricesPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [date, setDate] = useState(today);
  const [form, setForm] = useState({ customerId: "", productId: "", price: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const assignedCustomers = useMemo(() => {
    const map = new Map<string, Order["customer"] & { routeName: string }>();
    orders.forEach((order) => {
      const id = order.customerId || order.customer.id;
      if (!id) return;
      map.set(id, {
        ...order.customer,
        routeName: order.route?.name || order.customer.route?.name || "No route"
      });
    });
    return Array.from(map.entries()).map(([id, customer]) => ({ id, ...customer })).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const customerOptions = useMemo(
    () => assignedCustomers.map((customer) => ({
      value: customer.id,
      label: customer.name,
      description: [customer.phone, customer.routeName].filter(Boolean).join(" · ")
    })),
    [assignedCustomers]
  );

  const productOptions = useMemo(
    () => products.map((product) => ({
      value: product.id,
      label: product.name,
      description: [product.category, formatAmount(product.unitPrice)].filter(Boolean).join(" · ")
    })),
    [products]
  );

  const selectedProduct = products.find((product) => product.id === form.productId);

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: date, endDate: date, pageSize: "100" });
      const [orderData, productData] = await Promise.all([
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?${params.toString()}`),
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=100`)
      ]);
      setOrders(orderData.orders);
      setProducts(productData.products);
    } catch (error) {
      toast.error("Could not load pricing data", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  async function savePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/catalog/customer-prices`, {
        method: "POST",
        body: JSON.stringify({
          customerId: form.customerId,
          productId: form.productId,
          price: Number(form.price),
          notes: form.notes || "Vehicle dashboard price"
        })
      });
      toast.success("Customer price saved", "This product price is now set for the selected customer.");
      setForm((current) => ({ ...current, price: "", notes: "" }));
    } catch (error) {
      toast.error("Price save failed", error instanceof Error ? error.message : "Could not save customer price.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Customer product price settings" surface="vehicle">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Customer Prices</h1>
              <p className="mt-1 text-sm text-muted">Set product prices for customers visible on this vehicle route.</p>
            </div>
            <div className="flex gap-2">
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
            </div>
          </div>
          {loading ? <LoadingSpinner label="Loading customer prices" /> : null}
          <form className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_minmax(0,1fr)_auto] lg:items-end" onSubmit={savePrice}>
            <SearchableSelect
              label="Customer"
              onChange={(value) => setForm((current) => ({ ...current, customerId: value }))}
              options={customerOptions}
              placeholder="Select customer"
              required
              searchPlaceholder="Search customers"
              value={form.customerId}
            />
            <SearchableSelect
              label="Product"
              onChange={(value) => setForm((current) => ({ ...current, productId: value }))}
              options={productOptions}
              placeholder="Select product"
              required
              searchPlaceholder="Search products"
              value={form.productId}
            />
            <label className="grid gap-1 text-sm font-semibold">
              Price
              <input className="h-10 rounded-md border border-line bg-panel2 px-3 outline-none focus:border-mint" min="0" onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder={selectedProduct ? String(selectedProduct.unitPrice) : "0"} required type="number" value={form.price} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Notes
              <input className="h-10 rounded-md border border-line bg-panel2 px-3 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional" value={form.notes} />
            </label>
            <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-4 font-semibold text-white" disabled={saving || !form.customerId || !form.productId || !form.price} type="submit">
              <IndianRupee size={16} />
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
          <div className="border-t border-line p-4 text-sm text-muted">
            Visible customers: <span className="font-semibold text-ink">{assignedCustomers.length}</span>
            <span className="px-2">·</span>
            Products: <span className="font-semibold text-ink">{products.length}</span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
