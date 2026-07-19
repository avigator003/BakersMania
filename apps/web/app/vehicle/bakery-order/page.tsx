"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Send } from "lucide-react";
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
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
  active: boolean;
};
type Category = { id: string; name: string; active?: boolean };
type TruckLoading = {
  date: string;
  totals: Record<string, number>;
};
type BakeryOrder = {
  id: string;
  dueAt?: string | null;
  createdAt: string;
  grandTotal: string | number;
  status: string;
  vehicleStatus: string;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    quantity: string | number;
    product?: { category?: string | null; categoryRef?: { name: string } | null } | null;
  }>;
};

const tomorrow = localDateInput(addLocalDays(new Date(), 1));

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

export default function VehicleBakeryOrderPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bakeryOrders, setBakeryOrders] = useState<BakeryOrder[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [date, setDate] = useState(tomorrow);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [extraProductId, setExtraProductId] = useState("");
  const [extraQuantity, setExtraQuantity] = useState("1");
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.active !== false).map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => productCategory(a).localeCompare(productCategory(b)) || a.name.localeCompare(b.name)),
    [products]
  );

  const productOptions = useMemo(
    () => sortedProducts.map((product) => ({ value: product.id, label: product.name, description: productCategory(product) })),
    [sortedProducts]
  );

  const visibleProducts = useMemo(() => sortedProducts.filter((product) => {
    if (categoryFilter && product.categoryId !== categoryFilter && product.categoryRef?.id !== categoryFilter) return false;
    if (productFilter && product.id !== productFilter) return false;
    return true;
  }), [categoryFilter, productFilter, sortedProducts]);

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
      const [productData, categoryData, loadingData, bakeryOrderData] = await Promise.all([
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=500`),
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`),
        authFetch<{ truckLoading: TruckLoading }>(`${apiBase}/orders/truck-loading?date=${encodeURIComponent(date)}`),
        authFetch<{ orders: BakeryOrder[] }>(`${apiBase}/orders/vehicle-bakery-orders?date=${encodeURIComponent(date)}`)
      ]);
      const activeProducts = productData.products.filter((product) => product.active !== false);
      const nextTotals = loadingData.truckLoading.totals || {};
      setProducts(activeProducts);
      setCategories(categoryData.categories);
      setBakeryOrders(bakeryOrderData.orders);
      setTotals(nextTotals);
      setQuantities(Object.fromEntries(activeProducts.map((product) => [product.id, String(nextTotals[product.id] || 0)])));
    } catch (error) {
      toast.error("Could not load bakery order", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  function updateQuantity(productId: string, value: string) {
    setQuantities((current) => ({ ...current, [productId]: value }));
  }

  function openReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewOpen(true);
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
    updateQuantity(extraProductId, String(quantity));
    setExtraProductId("");
    setExtraQuantity("1");
  }

  async function createBakeryOrder() {
    if (!apiBase || !orderItems.length) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/vehicle-bakery-order`, {
        method: "POST",
        body: JSON.stringify({
          dueAt: date,
          items: orderItems
        })
      });
      toast.success("Bakery order saved", "The bakery can now see this order for the selected date.");
      setReviewOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Could not save bakery order", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Create order to bakery" surface="vehicle">
      <form className="grid gap-4" onSubmit={openReview}>
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="grid gap-3 border-b border-line p-4 xl:grid-cols-[220px_minmax(190px,260px)_minmax(220px,1fr)_auto_auto] xl:items-end">
            <label className="grid gap-1 text-sm font-semibold">
              Order date
              <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={setDate} value={date} />
            </label>
            <SearchableSelect onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={categoryFilter} />
            <SearchableSelect onChange={setProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={productFilter} />
            <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 text-sm font-semibold" onClick={loadData} type="button">
              <RefreshCw size={16} />
              Refresh
            </button>
            <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || loading} type="submit">
              <Send size={16} />
              {saving ? "Saving..." : "Create Order"}
            </button>
          </div>

          <div className="grid gap-2 border-b border-line p-4 text-sm text-muted sm:flex sm:flex-wrap sm:items-center">
            <span>Products: <strong className="text-ink">{orderItems.length}</strong></span>
            <span className="hidden sm:inline">·</span>
            <span>Total Quantity: <strong className="text-ink">{formatQty(totalQuantity)}</strong></span>
          </div>

          {loading ? <LoadingSpinner label="Loading product totals" /> : null}

          <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Total Quantity</th>
                  <th className="px-4 py-3 text-right">Bakery Order Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3 font-semibold">{product.name}</td>
                    <td className="px-4 py-3 text-muted">{productCategory(product)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatQty(totals[product.id])}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        className="ml-auto w-28 rounded-md border border-line bg-panel2 px-3 py-2 text-right font-semibold outline-none focus:border-mint"
                        min="0"
                        onChange={(event) => updateQuantity(product.id, event.target.value)}
                        step="0.001"
                        type="number"
                        value={quantities[product.id] ?? "0"}
                      />
                    </td>
                  </tr>
                ))}
                {!loading && !visibleProducts.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-muted" colSpan={4}>No products found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-3 sm:hidden">
            {visibleProducts.map((product) => (
              <article className="rounded-lg border border-line bg-panel2 p-3" key={product.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{product.name}</h2>
                    <p className="mt-1 truncate text-xs text-muted">{productCategory(product)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{formatQty(totals[product.id])}</span>
                </div>
                <input
                  className="mt-3 w-full rounded-md border border-line bg-panel px-3 py-2 text-right font-semibold outline-none focus:border-mint"
                  min="0"
                  onChange={(event) => updateQuantity(product.id, event.target.value)}
                  step="0.001"
                  type="number"
                  value={quantities[product.id] ?? "0"}
                />
              </article>
            ))}
            {!loading && !visibleProducts.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No products found.</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Orders Placed to Bakery</h2>
              <p className="text-sm text-muted">{date}</p>
            </div>
            <span className="text-sm text-muted">Orders: <strong className="text-ink">{bakeryOrders.length}</strong></span>
          </div>
          <div className="hidden max-h-[360px] overflow-auto sm:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bakeryOrders.map((order) => {
                  const quantity = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-semibold">{orderDate(order)}</td>
                      <td className="px-4 py-3 text-muted">{order.items.map((item) => `${item.name} (${formatQty(item.quantity)})`).join(", ")}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatQty(quantity)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(order.grandTotal)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md border border-line bg-panel2 px-2 py-1 text-xs font-semibold">{order.vehicleStatus}</span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !bakeryOrders.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-muted" colSpan={5}>No bakery orders placed for this date.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-3 sm:hidden">
            {bakeryOrders.map((order) => {
              const quantity = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
              return (
                <article className="rounded-lg border border-line bg-panel2 p-3" key={order.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{orderDate(order)}</h3>
                      <p className="mt-1 text-xs text-muted">Qty {formatQty(quantity)} · {formatCurrency(order.grandTotal)}</p>
                    </div>
                    <span className="rounded-md border border-line bg-panel px-2 py-1 text-xs font-semibold">{order.vehicleStatus}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted">{order.items.map((item) => `${item.name} (${formatQty(item.quantity)})`).join(", ")}</p>
                </article>
              );
            })}
            {!loading && !bakeryOrders.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No bakery orders placed for this date.</p> : null}
          </div>
        </section>
      </form>
      <Modal open={reviewOpen} title="Create Order" description={`${orderRows.length} product${orderRows.length === 1 ? "" : "s"} · Qty ${formatQty(totalQuantity)} · ${date}`} onClose={() => setReviewOpen(false)}>
        <div className="mb-4 grid gap-3 rounded-lg border border-line bg-panel2 p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
          <SearchableSelect
            disabled={!extraProductOptions.length}
            label="Add product"
            onChange={setExtraProductId}
            options={extraProductOptions}
            placeholder={extraProductOptions.length ? "Select product" : "All products added"}
            searchPlaceholder="Search products"
            value={extraProductId}
          />
          <label className="grid gap-1 text-sm font-semibold">
            Quantity
            <input
              className="rounded-md border border-line bg-panel px-3 py-2 text-right font-semibold outline-none focus:border-mint"
              min="0"
              onChange={(event) => setExtraQuantity(event.target.value)}
              step="0.001"
              type="number"
              value={extraQuantity}
            />
          </label>
          <button
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-4 text-sm font-semibold disabled:opacity-50"
            disabled={!extraProductOptions.length}
            onClick={addExtraProduct}
            type="button"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-line">
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
                  <td className="px-4 py-3 text-right font-semibold">{formatQty(item.quantity)}</td>
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
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setReviewOpen(false)} type="button">Cancel</button>
          <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={saving || !orderRows.length} onClick={createBakeryOrder} type="button">
            <Send size={16} />
            {saving ? "Saving..." : "Confirm Order"}
          </button>
        </div>
      </Modal>
    </AppShell>
  );
}
