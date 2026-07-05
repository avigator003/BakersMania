"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Download, Eye, FileDown, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { Modal } from "../../../components/modal";
import { PaginationControls, usePagination } from "../../../components/pagination";
import { PaymentHistory, paymentDue, paymentTotal, resolvedPaymentStatus } from "../../../components/payment-history";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Route = { id: string; name: string };
type Customer = { id: string; name: string; phone?: string | null; route?: Route | null };
type Category = { id: string; name: string };
type Product = { id: string; name: string; category: string; unitPrice: string; categoryRef?: Category | null };
type OrderItem = { id: string; productId: string; name: string; quantity: string | number; unitPrice: string | number; lineTotal: string | number };
type Payment = { id: string; amount: string | number; method?: string | null; reference?: string | null; paidAt?: string | null };
type Invoice = { id: string; invoiceNumber: string; createdAt: string; total: string | number; paymentStatus: string };
type Order = {
  id: string;
  source: string;
  status: string;
  paymentStatus: string;
  fulfillmentType: string;
  dueAt?: string | null;
  grandTotal: string | number;
  notes?: string | null;
  customer: Customer;
  route?: Route | null;
  items: OrderItem[];
  invoice?: Invoice | null;
  payments?: Payment[];
  createdAt: string;
};
type OrderFormState = {
  customerId: string;
  source: string;
  fulfillmentType: string;
  dueAt: string;
  notes: string;
  items: { id: string; productId: string; quantity: string }[];
};
type TruckLoading = {
  date: string;
  orderCount: number;
  products: { id: string; name: string; category: string }[];
  routes: { id: string; name: string; quantities: Record<string, number>; total: number }[];
  totals: Record<string, number>;
};
type RouteStatement = {
  startDate: string;
  endDate: string;
  routeId?: string;
  totals: { customers: number; orders: number; orderTotal: number; paidTotal: number; dueTotal: number };
  rows: { customerId: string; customerName: string; routeName: string; orderTotal: number; paidTotal: number; dueTotal: number; orderCount: number }[];
};

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const orderStatuses = ["PENDING", "ACCEPTED", "DISPATCHED", "COMPLETED"];
const paymentStatuses = ["UNPAID", "PARTIAL", "PAID"];
const emptyOrderForm: OrderFormState = {
  customerId: "",
  source: "STAFF_CREATED",
  fulfillmentType: "DELIVERY",
  dueAt: today,
  notes: "",
  items: [{ id: "row-1", productId: "", quantity: "" }]
};

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatQty(value?: string | number | null) {
  const amount = Number(value || 0);
  return amount ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount) : "";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function orderPaid(order: Order) {
  return paymentTotal(order.payments);
}

function orderDue(order: Order) {
  return paymentDue(order.grandTotal, order.payments);
}

function isCarryForwardDue(order: Order) {
  if (orderDue(order) <= 0) return false;
  const baseDate = (order.dueAt || order.createdAt).slice(0, 10);
  return baseDate <= today;
}

function paymentStatus(order: Order) {
  return resolvedPaymentStatus(order.grandTotal, order.payments, order.paymentStatus);
}

function orderStatusClass(status: string) {
  if (status === "COMPLETED") return "border-mint/30 bg-mint/10 text-mint";
  if (status === "DISPATCHED") return "border-sky-400/40 bg-sky-100 text-sky-700";
  if (status === "ACCEPTED") return "border-amber-400/40 bg-amber-100 text-amber-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function paymentStatusClass(status: string) {
  if (status === "PAID") return "border-mint/30 bg-mint/10 text-mint";
  if (status === "PARTIAL") return "border-amber-400/40 bg-amber-100 text-amber-700";
  return "border-berry/30 bg-berry/10 text-berry";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadFile(content: string, type: string, fileName: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BakeryOrdersPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"orders" | "truck">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [truckLoading, setTruckLoading] = useState<TruckLoading | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "Cash", reference: "" });
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");
  const [truckDate, setTruckDate] = useState(today);
  const [truckCategory, setTruckCategory] = useState("all");
  const [form, setForm] = useState<OrderFormState>(emptyOrderForm);
  const [editForm, setEditForm] = useState<OrderFormState>(emptyOrderForm);
  const [repeatForm, setRepeatForm] = useState({
    sourceDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    targetDate: today,
    routeId: "all"
  });

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((order) =>
      [order.customer.name, order.customer.phone, order.route?.name, order.customer.route?.name, order.source, order.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [orders, search]);
  const ordersPage = usePagination(filteredOrders, 25);

  const orderTotals = useMemo(() => {
    return {
      orders: orders.length,
      quantity: orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0),
      amount: orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
      paid: orders.reduce((sum, order) => sum + orderPaid(order), 0),
      due: orders.reduce((sum, order) => sum + orderDue(order), 0),
      todaysDue: orders.reduce((sum, order) => sum + (isCarryForwardDue(order) ? orderDue(order) : 0), 0)
    };
  }, [orders]);

  function getOrderRouteName(order: Order) {
    return order.route?.name || order.customer.route?.name || "No route";
  }

  const truckTotals = useMemo(() => {
    const totalQuantity = truckLoading?.routes.reduce((sum, route) => sum + route.total, 0) || 0;
    const activeProducts = truckLoading?.products.filter((product) => Number(truckLoading.totals[product.id] || 0) > 0).length || 0;
    return {
      routes: truckLoading?.routes.length || 0,
      products: activeProducts,
      quantity: totalQuantity,
      orders: truckLoading?.orderCount || 0
    };
  }, [truckLoading]);

  async function loadData() {
    if (!apiBase) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const orderParams = new URLSearchParams();
      if (startDate) orderParams.set("startDate", startDate);
      if (endDate) orderParams.set("endDate", endDate);
      if (customerFilter !== "all") orderParams.set("customerId", customerFilter);
      if (routeFilter !== "all") orderParams.set("routeId", routeFilter);
      const truckParams = new URLSearchParams();
      truckParams.set("date", truckDate);
      if (truckCategory !== "all") truckParams.set("categoryId", truckCategory);
      const [orderData, customerData, productData, categoryData, routeData, truckData] = await Promise.all([
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?${orderParams.toString()}`),
        authFetch<{ customers: Customer[] }>(`${apiBase}/customers`),
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products`),
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`),
        authFetch<{ routes: Route[] }>(`${apiBase}/routes`),
        authFetch<{ truckLoading: TruckLoading }>(`${apiBase}/orders/truck-loading?${truckParams.toString()}`)
      ]);
      setOrders(orderData.orders);
      setCustomers(customerData.customers);
      setProducts(productData.products);
      setCategories(categoryData.categories);
      setRoutes(routeData.routes);
      setTruckLoading(truckData.truckLoading);
    } catch (error) {
      toast.error("Could not load orders", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [truckDate, truckCategory, startDate, endDate, customerFilter, routeFilter]);

  function updateFormItem(
    setter: typeof setForm,
    rowId: string,
    patch: Partial<{ productId: string; quantity: string }>
  ) {
    setter((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === rowId ? { ...item, ...patch } : item))
    }));
  }

  function addFormItem(setter: typeof setForm) {
    setter((current) => ({ ...current, items: [...current.items, { id: `row-${Date.now()}`, productId: "", quantity: "" }] }));
  }

  function removeFormItem(setter: typeof setForm, rowId: string) {
    setter((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((item) => item.id !== rowId) }));
  }

  function openEditOrder(order: Order) {
    setEditOrder(order);
    setEditForm({
      customerId: order.customer.id,
      source: order.source,
      fulfillmentType: order.fulfillmentType,
      dueAt: (order.dueAt || order.createdAt).slice(0, 10),
      notes: order.notes || "",
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: String(item.quantity)
      }))
    });
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    const items = form.items
      .filter((item) => item.productId && Number(item.quantity) > 0)
      .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }));
    if (!items.length) {
      toast.warning("No products selected", "Add at least one product quantity.");
      return;
    }
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders`, {
        method: "POST",
        body: JSON.stringify({
          customerId: form.customerId,
          source: form.source,
          fulfillmentType: form.fulfillmentType,
          dueAt: form.dueAt,
          notes: form.notes || undefined,
          items
        })
      });
      toast.success("Order created", "Order quantities and truck loading data were updated.");
      setOrderOpen(false);
      setForm(emptyOrderForm);
      await loadData();
    } catch (error) {
      toast.error("Order creation failed", error instanceof Error ? error.message : "Could not create order.");
    } finally {
      setSaving(false);
    }
  }

  async function updateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !editOrder) return;
    const items = editForm.items
      .filter((item) => item.productId && Number(item.quantity) > 0)
      .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }));
    if (!items.length) {
      toast.warning("No products selected", "Add at least one product quantity.");
      return;
    }
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/${editOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          customerId: editForm.customerId,
          source: editForm.source,
          fulfillmentType: editForm.fulfillmentType,
          dueAt: editForm.dueAt,
          notes: editForm.notes || undefined,
          items
        })
      });
      toast.success("Order updated", "Amounts and truck loading quantities were recalculated.");
      setEditOrder(null);
      await loadData();
    } catch (error) {
      toast.error("Order update failed", error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setSaving(false);
    }
  }

  async function updateOrderStatus(order: Order, patch: { status?: string; paymentStatus?: string; paymentAmount?: number; paymentMethod?: string; reference?: string }) {
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      toast.success("Order updated", patch.paymentStatus ? "Payment status was updated." : "Order status was updated.");
      setPaymentOrder(null);
      setPaymentForm({ amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Update failed", error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setSaving(false);
    }
  }

  function handlePaymentStatusChange(order: Order, nextStatus: string) {
    if (nextStatus === paymentStatus(order)) return;
    if (nextStatus === "PARTIAL") {
      const due = orderDue(order);
      setPaymentOrder(order);
      setPaymentForm({ amount: due ? String(due) : "", method: "Cash", reference: "" });
      return;
    }
    updateOrderStatus(order, { paymentStatus: nextStatus });
  }

  async function recordPartialPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentOrder) return;
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast.warning("Amount required", "Enter the partial payment amount.");
      return;
    }
    await updateOrderStatus(paymentOrder, {
      paymentStatus: "PARTIAL",
      paymentAmount: amount,
      paymentMethod: paymentForm.method,
      reference: paymentForm.reference || undefined
    });
  }

  async function exportOrderInvoice(order: Order) {
    if (!apiBase) return;
    try {
      const { invoice } = await authFetch<{ invoice: Invoice }>(`${apiBase}/invoices/from-order/${order.id}`, {
        method: "POST"
      });
      const paid = orderPaid(order);
      const due = orderDue(order);
      const productRows = order.items.map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td style="text-align:right;">${escapeHtml(formatQty(item.quantity) || "0")}</td>
          <td style="text-align:right;">${escapeHtml(formatAmount(item.unitPrice))}</td>
          <td style="text-align:right;">${escapeHtml(formatAmount(item.lineTotal))}</td>
        </tr>
      `).join("");
      const paymentRows = (order.payments || []).map((payment, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(formatDate(payment.paidAt))}</td>
          <td>${escapeHtml(payment.method || "Cash")}</td>
          <td>${escapeHtml(payment.reference || "")}</td>
          <td style="text-align:right;">${escapeHtml(formatAmount(payment.amount))}</td>
        </tr>
      `).join("");
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #172033; margin: 32px; }
    h1 { margin: 0 0 4px; }
    .muted { color: #64748b; }
    .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 1px solid #dbe3ef; padding-bottom: 18px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border-bottom: 1px solid #dbe3ef; padding: 10px; text-align: left; }
    th { background: #f3f6fa; font-size: 12px; text-transform: uppercase; color: #64748b; }
    .totals { margin-left: auto; margin-top: 24px; width: 280px; }
    .totals div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbe3ef; }
    .strong { font-weight: 700; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <h1>Invoice ${escapeHtml(invoice.invoiceNumber)}</h1>
      <div class="muted">Order ${escapeHtml(order.id)}</div>
    </div>
    <div>
      <div class="strong">${escapeHtml(order.customer.name)}</div>
      <div class="muted">${escapeHtml(getOrderRouteName(order))}</div>
      <div class="muted">Order date: ${escapeHtml(formatDate(order.dueAt || order.createdAt))}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Product</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr>
    </thead>
    <tbody>${productRows}</tbody>
  </table>
  <div class="totals">
    <div><span>Order</span><span>${escapeHtml(formatAmount(order.grandTotal))}</span></div>
    <div><span>Paid</span><span>${escapeHtml(formatAmount(paid))}</span></div>
    <div class="strong"><span>Due</span><span>${escapeHtml(formatAmount(due))}</span></div>
    <div><span>Payment status</span><span>${escapeHtml(paymentStatus(order))}</span></div>
  </div>
  <h2>Payment History</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Date</th><th>Method</th><th>Reference</th><th style="text-align:right;">Amount</th></tr>
    </thead>
    <tbody>${paymentRows || '<tr><td colspan="5" class="muted">No payment recorded.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
      const fileBase = `${invoice.invoiceNumber}-${order.customer.name.replaceAll(" ", "-").toLowerCase()}`;
      const csvRows = [
        ["Invoice Number", invoice.invoiceNumber],
        ["Order ID", order.id],
        ["Customer", order.customer.name],
        ["Route", getOrderRouteName(order)],
        ["Order Date", formatDate(order.dueAt || order.createdAt)],
        ["Order Status", order.status],
        ["Payment Status", paymentStatus(order)],
        [],
        ["Product", "Quantity", "Unit Price", "Line Total"],
        ...order.items.map((item) => [item.name, formatQty(item.quantity) || "0", Number(item.unitPrice || 0), Number(item.lineTotal || 0)]),
        [],
        ["Order Total", "", "", Number(order.grandTotal || 0)],
        ["Paid", "", "", paid],
        ["Due", "", "", due],
        [],
        ["Payment #", "Date", "Method", "Reference", "Amount"],
        ...(order.payments || []).map((payment, index) => [
          index + 1,
          formatDate(payment.paidAt),
          payment.method || "Cash",
          payment.reference || "",
          Number(payment.amount || 0)
        ])
      ];
      const csv = csvRows.map((row) => row.map(csvCell).join(",")).join("\n");
      downloadFile(html, "text/html;charset=utf-8", `${fileBase}.html`);
      downloadFile(csv, "text/csv;charset=utf-8", `${fileBase}.csv`);
      toast.success("Invoice exported", `${invoice.invoiceNumber} HTML and CSV downloaded.`);
      await loadData();
    } catch (error) {
      toast.error("Invoice export failed", error instanceof Error ? error.message : "Could not export invoice.");
    }
  }

  async function repeatOrders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      const { result } = await authFetch<{ result: { copied: number } }>(`${apiBase}/orders/repeat`, {
        method: "POST",
        body: JSON.stringify({
          sourceDate: repeatForm.sourceDate,
          targetDate: repeatForm.targetDate,
          routeId: repeatForm.routeId === "all" ? undefined : repeatForm.routeId
        })
      });
      toast.success("Orders repeated", `${result.copied} order${result.copied === 1 ? "" : "s"} copied to ${repeatForm.targetDate}.`);
      setRepeatOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Repeat failed", error instanceof Error ? error.message : "Could not repeat orders.");
    } finally {
      setSaving(false);
    }
  }

  async function exportRouteStatement() {
    if (!apiBase) return;
    try {
      const params = new URLSearchParams({ startDate: startDate || today, endDate: endDate || today });
      if (routeFilter !== "all") params.set("routeId", routeFilter);
      const { statement } = await authFetch<{ statement: RouteStatement }>(`${apiBase}/orders/route-statement?${params.toString()}`);
      const rows = [
        ["Start Date", statement.startDate],
        ["End Date", statement.endDate],
        ["Customers", statement.totals.customers],
        ["Orders", statement.totals.orders],
        ["Order Total", statement.totals.orderTotal],
        ["Paid", statement.totals.paidTotal],
        ["Due", statement.totals.dueTotal],
        [],
        ["Route", "Customer", "Orders", "Order Total", "Paid", "Due"],
        ...statement.rows.map((row) => [row.routeName, row.customerName, row.orderCount, row.orderTotal, row.paidTotal, row.dueTotal])
      ];
      downloadFile(rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8", `route-statement-${statement.startDate}-to-${statement.endDate}.csv`);
      toast.success("Statement exported", `${statement.rows.length} customer row${statement.rows.length === 1 ? "" : "s"} downloaded.`);
    } catch (error) {
      toast.error("Statement export failed", error instanceof Error ? error.message : "Could not export route statement.");
    }
  }

  function exportTruckLoading() {
    if (!truckLoading) return;
    const header = ["Route Name", ...truckLoading.products.map((product) => product.name), "Total"];
    const rows = truckLoading.routes.map((route) => [
      route.name,
      ...truckLoading.products.map((product) => route.quantities[product.id] || ""),
      route.total || ""
    ]);
    const totalRow = ["Total", ...truckLoading.products.map((product) => truckLoading.totals[product.id] || ""), ""];
    const csv = [header, ...rows, totalRow].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `truck-loading-${truckLoading.date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Orders, product quantities, and truck loading" surface="bakery">
      <div className="grid min-w-0 gap-6">
        <div className="flex flex-wrap gap-2">
          <button className={`focus-ring rounded-md border px-4 py-2 text-sm font-semibold ${activeTab === "orders" ? "border-mint bg-mint text-white" : "border-line bg-panel"}`} onClick={() => setActiveTab("orders")} type="button">Orders</button>
          <button className={`focus-ring rounded-md border px-4 py-2 text-sm font-semibold ${activeTab === "truck" ? "border-mint bg-mint text-white" : "border-line bg-panel"}`} onClick={() => setActiveTab("truck")} type="button">Truck Loading</button>
        </div>

        {activeTab === "orders" ? (
          <>
            <section className="rounded-lg border border-line bg-panel shadow-subtle">
              <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-mint">Order Management</p>
                  <h1 className="mt-1 text-xl font-semibold">Customer orders with product quantities</h1>
                </div>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={() => setRepeatOpen(true)} type="button"><Copy size={16} /> Repeat Orders</button>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={exportRouteStatement} type="button"><Download size={16} /> Route Statement</button>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setOrderOpen(true)} type="button"><Plus size={16} /> Create Order</button>
                  <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh orders" type="button"><RefreshCw size={16} /></button>
                </div>
              </div>
              <div className="grid gap-3 border-b border-line p-4 lg:grid-cols-[1.3fr_170px_170px_1fr_1fr]">
                <label className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
                  <Search size={16} className="text-muted" />
                  <input className="w-full bg-transparent text-sm outline-none" onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, route, status" value={search} />
                </label>
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
                <select className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setCustomerFilter(event.target.value)} value={customerFilter}>
                  <option value="all">All customers</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} ({customer.route?.name || "No route"})</option>)}
                </select>
                <select className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setRouteFilter(event.target.value)} value={routeFilter}>
                  <option value="all">All routes</option>
                  {routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
                </select>
              </div>
              {loading ? <p className="p-4 text-sm text-muted">Loading orders...</p> : null}
              <div className="grid gap-3 p-3 sm:hidden">
                {ordersPage.pageItems.map((order) => {
                  const paid = orderPaid(order);
                  const due = orderDue(order);
                  const todaysDue = isCarryForwardDue(order) ? due : 0;
                  return (
                    <article key={order.id} className="rounded-lg border border-line bg-panel2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{order.customer.name}</h3>
                          <p className="truncate text-xs text-muted">{getOrderRouteName(order)} · {formatDate(order.dueAt || order.createdAt)}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-panel px-2 py-1 text-xs font-semibold">{order.items.length} items</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <span>
                          <span className="block text-xs text-muted">Order</span>
                          <span className="font-semibold">{formatAmount(order.grandTotal)}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-muted">Paid</span>
                          <span className="font-semibold">{formatAmount(paid)}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-muted">Due</span>
                          <span className="font-semibold text-berry">{formatAmount(due)}</span>
                        </span>
                      </div>
                      {todaysDue ? (
                        <p className="mt-3 rounded-md bg-panel px-3 py-2 text-xs font-semibold">Today's Due: {formatAmount(todaysDue)}</p>
                      ) : null}
                      <div className="mt-3">
                        <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                      </div>
                      <div className="mt-3 grid gap-2">
                        <select
                          className={`focus-ring rounded-md border px-2 py-2 text-xs font-semibold outline-none ${orderStatusClass(order.status)}`}
                          disabled={saving}
                          onChange={(event) => updateOrderStatus(order, { status: event.target.value })}
                          value={order.status}
                        >
                          {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <select
                          className={`focus-ring rounded-md border px-2 py-2 text-xs font-semibold outline-none ${paymentStatusClass(paymentStatus(order))}`}
                          disabled={saving}
                          onChange={(event) => handlePaymentStatusChange(order, event.target.value)}
                          value={paymentStatus(order)}
                        >
                          {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => setViewOrder(order)} title="View order details" type="button">
                          <Eye size={15} />
                        </button>
                        <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openEditOrder(order)} title="Edit order" type="button">
                          <Pencil size={15} />
                        </button>
                        <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => exportOrderInvoice(order)} title="Export invoice" type="button">
                          <FileDown size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
                {!loading && !filteredOrders.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No orders found.</p> : null}
              </div>

              <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
                <table className="min-w-[1120px] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Customer (Route)</th>
                      <th className="px-4 py-3 text-right">Products No.</th>
                      <th className="px-4 py-3 text-right">Order</th>
                      <th className="px-4 py-3 text-right">Due</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Today's Due</th>
                      <th className="px-4 py-3">Order Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ordersPage.pageItems.map((order) => {
                      const paid = orderPaid(order);
                      const due = orderDue(order);
                      const todaysDue = isCarryForwardDue(order) ? due : 0;
                      return (
                      <Fragment key={order.id}>
                      <tr className="align-top">
                        <td className="px-4 py-3">
                          <div className="flex min-w-64 items-start gap-3">
                            <div className="flex gap-1.5 pt-0.5">
                              <button className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-line bg-panel2" onClick={() => setViewOrder(order)} title="View order details" type="button">
                                <Eye size={15} />
                              </button>
                              <button className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-line bg-panel2" onClick={() => openEditOrder(order)} title="Edit order" type="button">
                                <Pencil size={15} />
                              </button>
                              <button className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-line bg-panel2" onClick={() => exportOrderInvoice(order)} title="Export invoice" type="button">
                                <FileDown size={15} />
                              </button>
                            </div>
                            <div>
                              <span className="block font-semibold">{order.customer.name}</span>
                              <span className="text-xs text-muted">{getOrderRouteName(order)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{order.items.length}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatAmount(order.grandTotal)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-berry">{formatAmount(due)}</td>
                        <td className="px-4 py-3 text-right">{formatAmount(paid)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{todaysDue ? formatAmount(todaysDue) : "-"}</td>
                        <td className="px-4 py-3">{formatDate(order.dueAt || order.createdAt)}</td>
                        <td className="px-4 py-3">
                          <select
                            className={`focus-ring rounded-md border px-2 py-1 text-xs font-semibold outline-none ${orderStatusClass(order.status)}`}
                            disabled={saving}
                            onChange={(event) => updateOrderStatus(order, { status: event.target.value })}
                            value={order.status}
                          >
                            {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className={`focus-ring rounded-md border px-2 py-1 text-xs font-semibold outline-none ${paymentStatusClass(paymentStatus(order))}`}
                            disabled={saving}
                            onChange={(event) => handlePaymentStatusChange(order, event.target.value)}
                            value={paymentStatus(order)}
                          >
                            {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </td>
                      </tr>
                      <tr className="bg-panel2/30">
                        <td className="px-4 py-3" colSpan={9}>
                          <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                        </td>
                      </tr>
                      </Fragment>
                      );
                    })}
                    {!loading && !filteredOrders.length ? <tr><td className="px-4 py-8 text-center text-muted" colSpan={9}>No orders found.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                {...ordersPage}
                summary={[
                  { label: "Quantity", value: formatQty(orderTotals.quantity) || "0" },
                  { label: "Total", value: formatAmount(orderTotals.amount) },
                  { label: "Due", value: formatAmount(orderTotals.due) },
                  { label: "Today due", value: formatAmount(orderTotals.todaysDue) }
                ]}
              />
            </section>
          </>
        ) : (
          <div className="grid min-w-0 gap-6">
            <section className="rounded-lg border border-line bg-panel shadow-subtle">
              <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-mint">Truck Loading</p>
                  <h1 className="mt-1 text-xl font-semibold">Route-wise product loading sheet</h1>
                  <p className="mt-1 text-sm text-muted">Quantities are grouped from orders by route and product for the selected loading date.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setTruckCategory(event.target.value)} value={truckCategory}>
                    <option value="all">All categories</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <input className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => setTruckDate(event.target.value)} type="date" value={truckDate} />
                  <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" disabled={!truckLoading?.routes.length} onClick={exportTruckLoading} type="button"><Download size={16} /> Export</button>
                  <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh loading" type="button"><RefreshCw size={16} /></button>
                </div>
              </div>

              {loading ? <p className="p-4 text-sm text-muted">Loading truck sheet...</p> : null}

              <div className="max-h-[700px] w-full max-w-full overflow-auto">
                <table className="min-w-full border-separate border-spacing-0 text-center text-sm">
                  <thead className="sticky top-0 z-20 text-xs uppercase text-muted">
                    <tr>
                      <th className="sticky left-0 z-40 min-w-44 border-b border-r border-line bg-panel2 px-4 py-3 text-left shadow-[8px_0_12px_rgba(23,32,51,0.08)]">Route Name</th>
                      {truckLoading?.products.map((product) => (
                        <th className="min-w-28 border-b border-r border-line bg-panel2 px-3 py-3" key={product.id}>
                          <span className="block text-ink">{product.name}</span>
                          <span className="mt-1 block text-[11px] normal-case text-muted">{product.category}</span>
                        </th>
                      ))}
                      <th className="sticky right-0 z-40 min-w-24 border-b border-line bg-panel2 px-4 py-3 shadow-[-8px_0_12px_rgba(23,32,51,0.08)]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {truckLoading?.routes.map((route, index) => (
                      <tr className={index % 2 ? "bg-panel2/30" : "bg-panel"} key={route.id}>
                        <td className={`sticky left-0 z-30 border-b border-r border-line px-4 py-3 text-left font-semibold text-ink shadow-[8px_0_12px_rgba(23,32,51,0.06)] ${index % 2 ? "bg-panel2" : "bg-panel"}`}>{route.name}</td>
                        {truckLoading.products.map((product) => {
                          const quantity = route.quantities[product.id] || 0;
                          return (
                            <td className={`border-b border-r border-line px-3 py-3 ${quantity ? "font-semibold text-ink" : "text-muted"}`} key={product.id}>
                              {formatQty(quantity) || "-"}
                            </td>
                          );
                        })}
                        <td className={`sticky right-0 z-30 border-b border-line px-4 py-3 font-bold text-mint shadow-[-8px_0_12px_rgba(23,32,51,0.06)] ${index % 2 ? "bg-panel2" : "bg-panel"}`}>{formatQty(route.total) || "-"}</td>
                      </tr>
                    ))}
                    {truckLoading && truckLoading.products.length ? (
                      <tr className="bg-mint/10 font-bold">
                        <td className="sticky left-0 z-30 border-b border-r border-line bg-[#e7f4f0] px-4 py-3 text-left shadow-[8px_0_12px_rgba(23,32,51,0.06)]">Product Total</td>
                        {truckLoading.products.map((product) => <td className="border-b border-r border-line px-3 py-3" key={product.id}>{formatQty(truckLoading.totals[product.id]) || "-"}</td>)}
                        <td className="sticky right-0 z-30 border-b border-line bg-[#e7f4f0] px-4 py-3 text-mint shadow-[-8px_0_12px_rgba(23,32,51,0.06)]">{formatQty(truckTotals.quantity) || "-"}</td>
                      </tr>
                    ) : null}
                    {!loading && (!truckLoading || !truckLoading.routes.length) ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-muted" colSpan={(truckLoading?.products.length || 0) + 2}>No truck loading data for this date.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>

      <Modal open={repeatOpen} title="Repeat orders" description="Copy all active orders from one date into another date, optionally for one route only." onClose={() => setRepeatOpen(false)}>
        <form className="grid gap-4" onSubmit={repeatOrders}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Source date<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setRepeatForm((current) => ({ ...current, sourceDate: event.target.value }))} required type="date" value={repeatForm.sourceDate} /></label>
            <label className="grid gap-1 text-sm font-semibold">Target date<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setRepeatForm((current) => ({ ...current, targetDate: event.target.value }))} required type="date" value={repeatForm.targetDate} /></label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Route<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setRepeatForm((current) => ({ ...current, routeId: event.target.value }))} value={repeatForm.routeId}><option value="all">All routes</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setRepeatOpen(false)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Copying..." : "Repeat Orders"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={orderOpen} title="Create order" description="Select customer and product quantities. The route is taken from the customer for truck loading." onClose={() => setOrderOpen(false)}>
        <form className="grid gap-4" onSubmit={createOrder}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Customer<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))} required value={form.customerId}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} ({customer.route?.name || "No route"})</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Order date<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} type="date" value={form.dueAt} /></label>
            <label className="grid gap-1 text-sm font-semibold">Source<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} value={form.source}><option value="STAFF_CREATED">Staff created</option><option value="WHATSAPP">WhatsApp</option><option value="PHONE">Phone</option><option value="WALK_IN">Walk-in</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Fulfillment<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, fulfillmentType: event.target.value }))} value={form.fulfillmentType}><option value="DELIVERY">Delivery</option><option value="PICKUP">Pickup</option></select></label>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Products</p>
              <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold" onClick={() => addFormItem(setForm)} type="button"><Plus size={15} /> Add Product</button>
            </div>
            {form.items.map((item) => (
              <div className="grid gap-2 rounded-md border border-line bg-panel2 p-3 sm:grid-cols-[1fr_120px_40px]" key={item.id}>
                <select className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" onChange={(event) => updateFormItem(setForm, item.id, { productId: event.target.value })} required value={item.productId}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatAmount(product.unitPrice)}</option>)}</select>
                <input className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" min="0.001" onChange={(event) => updateFormItem(setForm, item.id, { quantity: event.target.value })} placeholder="Qty" required step="0.001" type="number" value={item.quantity} />
                <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel" disabled={form.items.length === 1} onClick={() => removeFormItem(setForm, item.id)} title="Remove product" type="button"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} value={form.notes} /></label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setOrderOpen(false)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Create Order"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(viewOrder)} title="Order details" description="Customer, route, products, prices, and payment overview." onClose={() => setViewOrder(null)}>
        {viewOrder ? (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-lg border border-line bg-panel2 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted">Customer (Route)</p>
                <p className="mt-1 font-semibold">{viewOrder.customer.name}</p>
                <p className="text-sm text-muted">{getOrderRouteName(viewOrder)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Order date</p>
                <p className="mt-1 font-semibold">{formatDate(viewOrder.dueAt || viewOrder.createdAt)}</p>
                <p className="text-sm text-muted">{viewOrder.source} · {viewOrder.fulfillmentType}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Order</p>
                <p className="mt-1 font-semibold">{formatAmount(viewOrder.grandTotal)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Payment</p>
                <p className="mt-1 font-semibold">{paymentStatus(viewOrder)}</p>
                <p className="text-sm text-muted">Paid {formatAmount(orderPaid(viewOrder))} · Due {formatAmount(orderDue(viewOrder))}</p>
              </div>
            </div>

            <div className="w-full max-w-full overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {viewOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold">{item.name}</td>
                      <td className="px-4 py-3 text-right">{formatQty(item.quantity)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PaymentHistory payments={viewOrder.payments} total={viewOrder.grandTotal} />

            {viewOrder.notes ? (
              <div className="rounded-lg border border-line bg-panel2 p-4">
                <p className="text-xs uppercase text-muted">Notes</p>
                <p className="mt-1 text-sm">{viewOrder.notes}</p>
              </div>
            ) : null}

            <div className="flex justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setViewOrder(null)} type="button">Close</button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(editOrder)} title="Edit order" description="Change customer, date, source, and product quantities." onClose={() => setEditOrder(null)}>
        <form className="grid gap-4" onSubmit={updateOrder}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Customer<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, customerId: event.target.value }))} required value={editForm.customerId}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} ({customer.route?.name || "No route"})</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Order date<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, dueAt: event.target.value }))} type="date" value={editForm.dueAt} /></label>
            <label className="grid gap-1 text-sm font-semibold">Source<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, source: event.target.value }))} value={editForm.source}><option value="STAFF_CREATED">Staff created</option><option value="WHATSAPP">WhatsApp</option><option value="PHONE">Phone</option><option value="WALK_IN">Walk-in</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Fulfillment<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, fulfillmentType: event.target.value }))} value={editForm.fulfillmentType}><option value="DELIVERY">Delivery</option><option value="PICKUP">Pickup</option></select></label>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Products</p>
              <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold" onClick={() => addFormItem(setEditForm)} type="button"><Plus size={15} /> Add Product</button>
            </div>
            {editForm.items.map((item) => (
              <div className="grid gap-2 rounded-md border border-line bg-panel2 p-3 sm:grid-cols-[1fr_120px_40px]" key={item.id}>
                <select className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" onChange={(event) => updateFormItem(setEditForm, item.id, { productId: event.target.value })} required value={item.productId}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatAmount(product.unitPrice)}</option>)}</select>
                <input className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" min="0.001" onChange={(event) => updateFormItem(setEditForm, item.id, { quantity: event.target.value })} placeholder="Qty" required step="0.001" type="number" value={item.quantity} />
                <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel" disabled={editForm.items.length === 1} onClick={() => removeFormItem(setEditForm, item.id)} title="Remove product" type="button"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} value={editForm.notes} /></label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setEditOrder(null)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Order"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(paymentOrder)} title="Record partial payment" description="Add the amount received for this order." onClose={() => setPaymentOrder(null)}>
        {paymentOrder ? (
          <form className="grid gap-4" onSubmit={recordPartialPayment}>
            <div className="grid gap-3 rounded-lg border border-line bg-panel2 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-muted">Order</p>
                <p className="mt-1 font-semibold">{formatAmount(paymentOrder.grandTotal)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Paid</p>
                <p className="mt-1 font-semibold">{formatAmount(orderPaid(paymentOrder))}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Due</p>
                <p className="mt-1 font-semibold text-berry">{formatAmount(orderDue(paymentOrder))}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">
                Partial amount
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  max={orderDue(paymentOrder)}
                  min="1"
                  onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                  required
                  type="number"
                  value={paymentForm.amount}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Method
                <select
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}
                  value={paymentForm.method}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-sm font-semibold">
              Reference
              <input
                className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))}
                placeholder="Optional receipt, UPI, or note"
                value={paymentForm.reference}
              />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setPaymentOrder(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Record Payment"}</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </AppShell>
  );
}
