"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Send } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, addLocalDays, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Product = {
  id: string;
  name: string;
  category?: string | null;
  categoryRef?: { id: string; name: string } | null;
  active: boolean;
};
type BakeryOrder = {
  id: string;
  dueAt?: string | null;
  createdAt: string;
  grandTotal: string | number;
  previousDueAmount?: string | number;
  orderAmount?: string | number;
  paidAmount?: string | number;
  todaysDueAmount?: string | number;
  status: string;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: string | number;
    product?: { category?: string | null; categoryRef?: { name: string } | null } | null;
  }>;
};

function formatQty(value?: string | number | null) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function formatCurrency(value?: string | number | null) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0, style: "currency", currency: "INR" });
}

function productCategory(product: Product) {
  return product.categoryRef?.name || product.category || "General";
}

function orderDate(order: BakeryOrder) {
  return (order.dueAt || order.createdAt).slice(0, 10);
}

export default function VehicleBakeryOrdersPage() {
  const toast = useToast();
  const [date, setDate] = useState(localDateInput(addLocalDays(new Date(), 1)));
  const [orders, setOrders] = useState<BakeryOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [editingOrder, setEditingOrder] = useState<BakeryOrder | null>(null);
  const [extraProductId, setExtraProductId] = useState("");
  const [extraQuantity, setExtraQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => productCategory(a).localeCompare(productCategory(b)) || a.name.localeCompare(b.name)),
    [products]
  );

  const orderItems = useMemo(() => sortedProducts
    .map((product) => ({ productId: product.id, quantity: Number(quantities[product.id] || 0) }))
    .filter((item) => item.quantity > 0), [quantities, sortedProducts]);

  const orderRows = useMemo(() => orderItems.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return {
      ...item,
      name: product?.name || "Product",
      category: product ? productCategory(product) : "General"
    };
  }), [orderItems, products]);

  const extraProductOptions = useMemo(() => {
    const orderedIds = new Set(orderItems.map((item) => item.productId));
    return sortedProducts
      .filter((product) => !orderedIds.has(product.id))
      .map((product) => ({ value: product.id, label: product.name, description: productCategory(product) }));
  }, [orderItems, sortedProducts]);

  const totalQuantity = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.quantity, 0),
    [orderItems]
  );

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const [orderData, productData] = await Promise.all([
        authFetch<{ orders: BakeryOrder[] }>(`${apiBase}/orders/vehicle-bakery-orders?date=${encodeURIComponent(date)}`),
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=500`)
      ]);
      setOrders(orderData.orders);
      setProducts(productData.products.filter((product) => product.active !== false));
    } catch (error) {
      toast.error("Could not load bakery orders", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  function openEdit(order: BakeryOrder) {
    if (order.status !== "PENDING") {
      toast.warning("Cannot edit order", "Only pending bakery orders can be edited.");
      return;
    }
    const nextQuantities = Object.fromEntries(products.map((product) => [product.id, "0"]));
    order.items.forEach((item) => {
      nextQuantities[item.productId] = String(item.quantity || 0);
    });
    setQuantities(nextQuantities);
    setEditingOrder(order);
    setExtraProductId("");
    setExtraQuantity("1");
  }

  function closeEdit() {
    setEditingOrder(null);
    setExtraProductId("");
    setExtraQuantity("1");
    setQuantities({});
  }

  function addExtraProduct() {
    const quantity = Number(extraQuantity || 0);
    if (!extraProductId) {
      toast.warning("Select product", "Choose a product to add.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.warning("Enter quantity", "Quantity must be greater than 0.");
      return;
    }
    setQuantities((current) => ({ ...current, [extraProductId]: String(quantity) }));
    setExtraProductId("");
    setExtraQuantity("1");
  }

  async function updateOrder() {
    if (!apiBase || !editingOrder || !orderItems.length) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/${editingOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          source: "STAFF_CREATED",
          fulfillmentType: "DELIVERY",
          dueAt: date,
          items: orderItems
        })
      });
      toast.success("Bakery order updated", "Pending bakery order was updated.");
      closeEdit();
      await loadData();
    } catch (error) {
      toast.error("Could not update bakery order", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Bakery orders" surface="vehicle">
      <section className="rounded-lg border border-line bg-panel shadow-subtle">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
          <div>
            <h1 className="text-lg font-semibold">Bakery Orders</h1>
            <p className="text-sm text-muted">Orders placed to bakery for the selected date.</p>
          </div>
          <label className="grid gap-1 text-sm font-semibold">
            Order date
            <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={setDate} value={date} />
          </label>
          <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 text-sm font-semibold" onClick={loadData} type="button">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? <LoadingSpinner label="Loading bakery orders" /> : null}

        <div className="hidden max-h-[680px] overflow-auto sm:block">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Previous Due Amount</th>
                <th className="px-4 py-3 text-right">Order Amount</th>
                <th className="px-4 py-3 text-right">Paid Amount</th>
                <th className="px-4 py-3 text-right">Today's Due Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((order) => {
                const quantity = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                return (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-semibold">{orderDate(order)}</td>
                    <td className="px-4 py-3 text-muted">{order.items.map((item) => `${item.name} (${formatQty(item.quantity)})`).join(", ")}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatQty(quantity)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(order.previousDueAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(order.orderAmount ?? order.grandTotal)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(order.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-berry">{formatCurrency(order.todaysDueAmount)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border border-line bg-panel2 px-2 py-1 text-xs font-semibold">{order.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {order.status === "PENDING" ? (
                        <button className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 text-xs font-semibold" onClick={() => openEdit(order)} type="button">
                          <Pencil size={14} />
                          Edit
                        </button>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && !orders.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-muted" colSpan={9}>No bakery orders placed for this date.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-3 sm:hidden">
          {orders.map((order) => {
            const quantity = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            return (
              <article className="rounded-lg border border-line bg-panel2 p-3" key={order.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{orderDate(order)}</h2>
                    <p className="mt-1 text-xs text-muted">Qty {formatQty(quantity)} · Order {formatCurrency(order.orderAmount ?? order.grandTotal)}</p>
                  </div>
                  <span className="rounded-md border border-line bg-panel px-2 py-1 text-xs font-semibold">{order.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-md bg-panel px-2 py-1 text-muted">Previous due <strong className="block text-ink">{formatCurrency(order.previousDueAmount)}</strong></span>
                  <span className="rounded-md bg-panel px-2 py-1 text-muted">Paid <strong className="block text-ink">{formatCurrency(order.paidAmount)}</strong></span>
                  <span className="rounded-md bg-panel px-2 py-1 text-muted">Today due <strong className="block text-berry">{formatCurrency(order.todaysDueAmount)}</strong></span>
                  <span className="rounded-md bg-panel px-2 py-1 text-muted">Order <strong className="block text-ink">{formatCurrency(order.orderAmount ?? order.grandTotal)}</strong></span>
                </div>
                <p className="mt-3 text-sm text-muted">{order.items.map((item) => `${item.name} (${formatQty(item.quantity)})`).join(", ")}</p>
                {order.status === "PENDING" ? (
                  <button className="focus-ring mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-semibold" onClick={() => openEdit(order)} type="button">
                    <Pencil size={15} />
                    Edit
                  </button>
                ) : null}
              </article>
            );
          })}
          {!loading && !orders.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No bakery orders placed for this date.</p> : null}
        </div>
      </section>

      <Modal open={Boolean(editingOrder)} title="Edit Order" description={`${orderRows.length} product${orderRows.length === 1 ? "" : "s"} · Qty ${formatQty(totalQuantity)} · ${date}`} onClose={closeEdit}>
        <div className="mb-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={closeEdit} type="button">Cancel</button>
          <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={saving || !orderRows.length} onClick={updateOrder} type="button">
            <Send size={16} />
            {saving ? "Saving..." : "Update Order"}
          </button>
        </div>
        <div className="mb-4 grid gap-3 rounded-lg border border-line bg-panel2 p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
          <SearchableSelect disabled={!extraProductOptions.length} label="Add product" onChange={setExtraProductId} options={extraProductOptions} placeholder={extraProductOptions.length ? "Select product" : "All products added"} searchPlaceholder="Search products" value={extraProductId} />
          <label className="grid gap-1 text-sm font-semibold">
            Quantity
            <input className="rounded-md border border-line bg-panel px-3 py-2 text-right font-semibold outline-none focus:border-mint" min="0" onChange={(event) => setExtraQuantity(event.target.value)} step="0.001" type="number" value={extraQuantity} />
          </label>
          <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold disabled:opacity-50" disabled={!extraProductOptions.length} onClick={addExtraProduct} type="button">
            <Plus size={16} />
            Add
          </button>
        </div>
        <div className="max-h-[72vh] overflow-auto rounded-lg border border-line">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orderRows.map((item) => (
                <tr key={item.productId}>
                  <td className="px-4 py-3 font-semibold">{item.name}</td>
                  <td className="px-4 py-3 text-muted">{item.category}</td>
                  <td className="px-4 py-3 text-right">
                    <input className="ml-auto w-28 rounded-md border border-line bg-panel2 px-3 py-2 text-right font-semibold outline-none focus:border-mint" min="0" onChange={(event) => setQuantities((current) => ({ ...current, [item.productId]: event.target.value }))} step="0.001" type="number" value={quantities[item.productId] ?? String(item.quantity)} />
                  </td>
                </tr>
              ))}
              {!orderRows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={3}>No products selected.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Modal>
    </AppShell>
  );
}
