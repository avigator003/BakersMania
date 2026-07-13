"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Download, Eye, FileDown, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, addLocalDays, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaginationControls } from "../../../components/pagination";
import { PaymentHistory, paymentDue, paymentTotal, resolvedPaymentStatus } from "../../../components/payment-history";
import { SearchableSelect } from "../../../components/searchable-select";
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
type RouteStatement = {
  startDate: string;
  endDate: string;
  routeId?: string;
  totals: { customers: number; orders: number; orderTotal: number; paidTotal: number; dueTotal: number };
  rows: { customerId: string; customerName: string; routeName: string; orderTotal: number; paidTotal: number; dueTotal: number; orderCount: number }[];
};
type PaginatedOrdersResponse = {
  orders: Order[];
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  };
};
type CarryForwardSummary = { orders: number; quantity: number; previousDue: number };

const today = localDateInput();
const tomorrow = localDateInput(addLocalDays(new Date(), 1));
const orderStatuses = ["PENDING", "ACCEPTED", "COMPLETED"];
const paymentMethods = ["Cash", "UPI"];
const paymentTypes = [
  { value: "PARTIAL", label: "Partial" },
  { value: "ORDER_FULL", label: "Order Full Payment" },
  { value: "DUE_FULL", label: "Due Full Payment" }
];
const emptyOrderForm: OrderFormState = {
  customerId: "",
  source: "STAFF_CREATED",
  fulfillmentType: "DELIVERY",
  dueAt: tomorrow,
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

function orderDateKey(order: Order) {
  return (order.dueAt || order.createdAt).slice(0, 10);
}

function customerKey(order: Order) {
  return order.customer.id || order.customer.name;
}

function orderPaid(order: Order) {
  return paymentTotal(order.payments);
}

function orderDue(order: Order) {
  return paymentDue(order.grandTotal, order.payments);
}

function totalAmount(previousDue: number, orderAmount: string | number) {
  return Number(previousDue || 0) + Number(orderAmount || 0);
}

function todaysDueAmount(previousDue: number, orderAmount: string | number, paidAmount: string | number) {
  return Math.max(totalAmount(previousDue, orderAmount) - Number(paidAmount || 0), 0);
}

function paymentStatus(order: Order) {
  return resolvedPaymentStatus(order.grandTotal, order.payments, order.paymentStatus);
}

function orderStatusClass(status: string) {
  if (status === "COMPLETED") return "border-mint/30 bg-mint/10 text-mint";
  if (status === "ACCEPTED") return "border-amber-400/40 bg-amber-100 text-amber-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function selectableOrderStatus(status: string) {
  return orderStatuses.includes(status) ? status : "ACCEPTED";
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

function printInvoicePdf(html: string) {
  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
  return true;
}

export default function BakeryOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [previousOrders, setPreviousOrders] = useState<Order[]>([]);
  const [carryForwardSummary, setCarryForwardSummary] = useState<CarryForwardSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [routeFilter, setRouteFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPageCount, setOrdersPageCount] = useState(1);
  const [form, setForm] = useState<OrderFormState>(emptyOrderForm);
  const [editForm, setEditForm] = useState<OrderFormState>(emptyOrderForm);
  const [repeatForm, setRepeatForm] = useState({
    sourceDate: localDateInput(addLocalDays(new Date(), -1)),
    targetDate: today,
    routeId: "all"
  });

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const customerOptions = useMemo(() => customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
    description: [customer.phone, customer.route?.name || "No route"].filter(Boolean).join(" · ")
  })), [customers]);

  const routeOptions = useMemo(() => routes.map((route) => ({
    value: route.id,
    label: route.name
  })), [routes]);

  const previousDueByCustomer = useMemo(() => {
    const dueByCustomer = new Map<string, number>();
    previousOrders.forEach((order) => {
      dueByCustomer.set(customerKey(order), (dueByCustomer.get(customerKey(order)) || 0) + orderDue(order));
    });
    return dueByCustomer;
  }, [previousOrders]);

  function previousDueForOrder(order: Order) {
    return previousDueByCustomer.get(customerKey(order)) || 0;
  }

  const orderTotals = useMemo(() => {
    const previousDue = orders.length
      ? orders.reduce((sum, order) => sum + previousDueForOrder(order), 0)
      : carryForwardSummary?.previousDue || 0;
    const amount = orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
    const paid = orders.reduce((sum, order) => sum + orderPaid(order), 0);
    const fullAmount = totalAmount(previousDue, amount);
    return {
      orders: orders.length || carryForwardSummary?.orders || 0,
      quantity: orders.length
        ? orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0)
        : carryForwardSummary?.quantity || 0,
      amount,
      paid,
      due: orders.reduce((sum, order) => sum + orderDue(order), 0),
      previousDue,
      totalAmount: fullAmount,
      todaysDue: Math.max(fullAmount - paid, 0)
    };
  }, [carryForwardSummary, orders, previousDueByCustomer]);

  function getOrderRouteName(order: Order) {
    return order.route?.name || order.customer.route?.name || "No route";
  }

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
      if (customerFilter.length) orderParams.set("customerIds", customerFilter.join(","));
      if (routeFilter.length) orderParams.set("routeIds", routeFilter.join(","));
      if (search.trim()) orderParams.set("search", search.trim());
      orderParams.set("page", String(page));
      orderParams.set("pageSize", String(pageSize));
      const previousEndDate = localDateInput(addLocalDays(new Date(`${startDate || today}T00:00:00`), -1));
      const previousParams = new URLSearchParams();
      previousParams.set("endDate", previousEndDate);
      previousParams.set("pageSize", "100");
      if (customerFilter.length) previousParams.set("customerIds", customerFilter.join(","));
      if (routeFilter.length) previousParams.set("routeIds", routeFilter.join(","));
      if (search.trim()) previousParams.set("search", search.trim());
      const [orderData, previousData, customerData, productData, routeData] = await Promise.all([
        authFetch<PaginatedOrdersResponse>(`${apiBase}/orders?${orderParams.toString()}`),
        authFetch<PaginatedOrdersResponse>(`${apiBase}/orders?${previousParams.toString()}`),
        authFetch<{ customers: Customer[] }>(`${apiBase}/customers?pageSize=100`),
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=100`),
        authFetch<{ routes: Route[] }>(`${apiBase}/routes?pageSize=100`)
      ]);
      let effectiveCarryForwardSummary: CarryForwardSummary | null = null;
      let effectiveTotal = orderData.pagination?.total ?? orderData.orders.length;
      let effectivePageCount = orderData.pagination?.pageCount ?? 1;
      let effectivePage = orderData.pagination?.page ?? page;
      let effectivePageSize = orderData.pagination?.pageSize ?? pageSize;
      if (!orderData.orders.length && effectiveTotal === 0) {
        const fallbackParams = new URLSearchParams();
        if (customerFilter.length) fallbackParams.set("customerIds", customerFilter.join(","));
        if (routeFilter.length) fallbackParams.set("routeIds", routeFilter.join(","));
        if (search.trim()) fallbackParams.set("search", search.trim());
        fallbackParams.set("page", "1");
        fallbackParams.set("pageSize", "100");
        fallbackParams.set("endDate", endDate || startDate || today);
        const fallbackData = await authFetch<PaginatedOrdersResponse>(`${apiBase}/orders?${fallbackParams.toString()}`);
        const latestDate = fallbackData.orders
          .map(orderDateKey)
          .sort((a, b) => b.localeCompare(a))[0];
        if (latestDate) {
          const fallbackPreviousEndDate = localDateInput(addLocalDays(new Date(`${latestDate}T00:00:00`), -1));
          const fallbackPreviousParams = new URLSearchParams();
          fallbackPreviousParams.set("endDate", fallbackPreviousEndDate);
          fallbackPreviousParams.set("pageSize", "100");
          if (customerFilter.length) fallbackPreviousParams.set("customerIds", customerFilter.join(","));
          if (routeFilter.length) fallbackPreviousParams.set("routeIds", routeFilter.join(","));
          if (search.trim()) fallbackPreviousParams.set("search", search.trim());
          const latestOrders = fallbackData.orders.filter((order) => orderDateKey(order) === latestDate);
          const fallbackPreviousOrders = (await authFetch<PaginatedOrdersResponse>(`${apiBase}/orders?${fallbackPreviousParams.toString()}`)).orders;
          const fallbackPreviousDueByCustomer = new Map<string, number>();
          fallbackPreviousOrders.forEach((order) => {
            fallbackPreviousDueByCustomer.set(customerKey(order), (fallbackPreviousDueByCustomer.get(customerKey(order)) || 0) + orderDue(order));
          });
          effectiveCarryForwardSummary = {
            orders: latestOrders.length,
            quantity: latestOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0),
            previousDue: latestOrders.reduce((sum, order) => (
              sum + todaysDueAmount(fallbackPreviousDueByCustomer.get(customerKey(order)) || 0, order.grandTotal, orderPaid(order))
            ), 0)
          };
        }
      }
      setOrders(orderData.orders);
      setPreviousOrders(previousData.orders);
      setCarryForwardSummary(effectiveCarryForwardSummary);
      setOrdersTotal(effectiveTotal);
      setOrdersPageCount(effectivePageCount);
      setPage(effectivePage);
      setPageSize(effectivePageSize);
      setCustomers(customerData.customers);
      setProducts(productData.products);
      setRoutes(routeData.routes);
    } catch (error) {
      toast.error("Could not load orders", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [startDate, endDate, customerFilter, routeFilter, search, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, customerFilter, routeFilter, search]);

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
    if (order.status !== "PENDING") {
      toast.warning("Order already accepted", "Only pending orders can be edited.");
      return;
    }
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
      setPaymentForm({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Update failed", error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setSaving(false);
    }
  }

  function todayDueForOrder(order: Order) {
    return todaysDueAmount(previousDueForOrder(order), order.grandTotal, orderPaid(order));
  }

  function paymentAmountForType(order: Order, type: string) {
    if (type === "ORDER_FULL") return Number(order.grandTotal || 0);
    if (type === "DUE_FULL") return todayDueForOrder(order);
    return 0;
  }

  function openPaymentEditor(order: Order, type = "PARTIAL") {
    const existingPayment = order.payments?.[0];
    const amount = existingPayment ? Number(existingPayment.amount || 0) : paymentAmountForType(order, type);
    setPaymentOrder(order);
    setPaymentForm({
      type,
      amount: amount ? String(amount) : "",
      method: existingPayment?.method || "Cash",
      reference: existingPayment?.reference || ""
    });
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentOrder) return;
    const amount = Number(paymentForm.amount);
    if (paymentForm.type === "PARTIAL" && (!amount || amount <= 0)) {
      toast.warning("Amount required", "Enter the partial payment amount.");
      return;
    }
    if (!apiBase || !paymentOrder.customer.id) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/customers/${paymentOrder.customer.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          mode: paymentForm.type,
          orderId: paymentOrder.id,
          date: (paymentOrder.dueAt || paymentOrder.createdAt).slice(0, 10),
          amount: paymentForm.type === "PARTIAL" ? amount : undefined,
          method: paymentForm.method,
          reference: paymentForm.reference || undefined
        })
      });
      toast.success("Payment saved", `${paymentOrder.customer.name} payment was updated.`);
      setPaymentOrder(null);
      setPaymentForm({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Payment failed", error instanceof Error ? error.message : "Could not save this payment.");
    } finally {
      setSaving(false);
    }
  }

  async function exportOrderInvoice(order: Order) {
    if (!apiBase) return;
    try {
      const { invoice } = await authFetch<{ invoice: Invoice }>(`${apiBase}/invoices/from-order/${order.id}`, {
        method: "POST"
      });
      const paid = orderPaid(order);
      const previousDue = previousDueForOrder(order);
      const fullAmount = totalAmount(previousDue, order.grandTotal);
      const due = todaysDueAmount(previousDue, order.grandTotal, paid);
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
    <div><span>Previous Due Amount</span><span>${escapeHtml(formatAmount(previousDue))}</span></div>
    <div><span>Order Amount</span><span>${escapeHtml(formatAmount(order.grandTotal))}</span></div>
    <div><span>Total Amount</span><span>${escapeHtml(formatAmount(fullAmount))}</span></div>
    <div><span>Paid Amount</span><span>${escapeHtml(formatAmount(paid))}</span></div>
    <div class="strong"><span>Today's Due Amount</span><span>${escapeHtml(formatAmount(due))}</span></div>
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
      if (!printInvoicePdf(html)) {
        toast.error("PDF export blocked", "Allow pop-ups to print or save this invoice as PDF.");
        return;
      }
      toast.success("Invoice ready", `${invoice.invoiceNumber} opened for PDF printing.`);
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
      if (routeFilter.length) params.set("routeIds", routeFilter.join(","));
      const { statement } = await authFetch<{ statement: RouteStatement }>(`${apiBase}/orders/route-statement?${params.toString()}`);
      const rows = [
        ["Start Date", statement.startDate],
        ["End Date", statement.endDate],
        ["Customers", statement.totals.customers],
        ["Orders", statement.totals.orders],
        ["Previous Due Amount", 0],
        ["Order Amount", statement.totals.orderTotal],
        ["Total Amount", statement.totals.orderTotal],
        ["Paid Amount", statement.totals.paidTotal],
        ["Today's Due Amount", statement.totals.dueTotal],
        [],
        ["Route", "Customer", "Orders", "Previous Due Amount", "Order Amount", "Total Amount", "Paid Amount", "Today's Due Amount"],
        ...statement.rows.map((row) => [row.routeName, row.customerName, row.orderCount, 0, row.orderTotal, row.orderTotal, row.paidTotal, row.dueTotal])
      ];
      downloadFile(rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8", `route-statement-${statement.startDate}-to-${statement.endDate}.csv`);
      toast.success("Statement exported", `${statement.rows.length} customer row${statement.rows.length === 1 ? "" : "s"} downloaded.`);
    } catch (error) {
      toast.error("Statement export failed", error instanceof Error ? error.message : "Could not export route statement.");
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Orders, product quantities, and truck loading" surface="bakery">
      <div className="grid min-w-0 gap-4">
            <section className="rounded-lg border border-line bg-panel shadow-subtle">
              <div className="flex flex-col gap-3 border-b border-line p-3 xl:flex-row xl:items-center xl:justify-end">
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={() => setRepeatOpen(true)} type="button"><Copy size={16} /> Repeat Orders</button>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={exportRouteStatement} type="button"><Download size={16} /> Route Statement</button>
                  <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setOrderOpen(true)} type="button"><Plus size={16} /> Create Order</button>
                  <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh orders" type="button"><RefreshCw size={16} /></button>
                </div>
              </div>
              <div className="grid gap-3 border-b border-line p-3 lg:grid-cols-[1.3fr_170px_170px_1fr_1fr]">
                <label className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
                  <Search size={16} className="text-muted" />
                  <input className="w-full bg-transparent text-sm outline-none" onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, route, status" value={search} />
                </label>
                <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={setStartDate} value={startDate} />
                <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={setEndDate} value={endDate} />
                <SearchableSelect multiple onChange={setCustomerFilter} options={customerOptions} placeholder="All customers" searchPlaceholder="Search customers" value={customerFilter} />
                <SearchableSelect multiple onChange={setRouteFilter} options={routeOptions} placeholder="All routes" searchPlaceholder="Search routes" value={routeFilter} />
              </div>
              {loading ? <LoadingSpinner label="Loading orders" /> : null}
              <PaginationControls
                page={page}
                pageCount={ordersPageCount}
                pageSize={pageSize}
                setPage={setPage}
                setPageSize={setPageSize}
                summary={[
                  { label: "Orders", value: orderTotals.orders },
                  { label: "Quantity", value: formatQty(orderTotals.quantity) || "0" },
                  { label: "Order Amount", value: formatAmount(orderTotals.amount) },
                  { label: "Previous Due Amount", value: formatAmount(orderTotals.previousDue) },
                  { label: "Paid Amount", value: formatAmount(orderTotals.paid) },
                  { label: "Today's Due Amount", value: formatAmount(orderTotals.todaysDue) }
                ]}
                total={ordersTotal}
              />
              <div className="grid gap-3 p-3 sm:hidden">
                {orders.map((order) => {
                  const paid = orderPaid(order);
                  const previousDue = previousDueForOrder(order);
                  const fullAmount = totalAmount(previousDue, order.grandTotal);
                  return (
                    <article key={order.id} className="rounded-lg border border-line bg-panel2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{order.customer.name}</h3>
                          <p className="truncate text-xs text-muted">{getOrderRouteName(order)} · {formatDate(order.dueAt || order.createdAt)}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-panel px-2 py-1 text-xs font-semibold">{order.items.length} items</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <span>
                          <span className="block text-xs text-muted">Previous Due Amount</span>
                          <span className="font-semibold">{formatAmount(previousDue)}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-muted">Order Amount</span>
                          <span className="font-semibold">{formatAmount(order.grandTotal)}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-muted">Total Amount</span>
                          <span className="font-semibold">{formatAmount(fullAmount)}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-muted">Paid Amount</span>
                          <span className="font-semibold">{formatAmount(paid)}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-muted">Today&apos;s Due Amount</span>
                          <span className="font-semibold text-berry">{formatAmount(todaysDueAmount(previousDue, order.grandTotal, paid))}</span>
                        </span>
                      </div>
                      {previousDue ? (
                        <p className="mt-3 rounded-md bg-panel px-3 py-2 text-xs font-semibold">Previous Due Amount: {formatAmount(previousDue)}</p>
                      ) : null}
                      <div className="mt-3">
                        <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                      </div>
                      <div className="mt-3 grid gap-2">
                        <select
                          className={`focus-ring rounded-md border px-2 py-2 text-xs font-semibold outline-none ${orderStatusClass(order.status)}`}
                          disabled={saving}
                          onChange={(event) => updateOrderStatus(order, { status: event.target.value })}
                          value={selectableOrderStatus(order.status)}
                        >
                          {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                        <span className={`rounded-md border px-2 py-2 text-xs font-semibold ${paymentStatusClass(paymentStatus(order))}`}>{paymentStatus(order)}</span>
                        <button className="focus-ring rounded-md bg-mint px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={saving || (todayDueForOrder(order) <= 0 && !order.payments?.length)} onClick={() => openPaymentEditor(order)} type="button">{order.payments?.length ? "Edit payment" : "Record payment"}</button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => setViewOrder(order)} title="View order details" type="button">
                          <Eye size={15} />
                        </button>
                        <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel disabled:opacity-50" disabled={order.status !== "PENDING"} onClick={() => openEditOrder(order)} title="Edit order" type="button">
                          <Pencil size={15} />
                        </button>
                        <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => exportOrderInvoice(order)} title="Export invoice" type="button">
                          <FileDown size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
                {!loading && !orders.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No orders found.</p> : null}
              </div>

              <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
                <table className="min-w-[1260px] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                    <tr>
                      <th className="px-4 py-3">Customer (Route)</th>
                      <th className="px-4 py-3 text-right">Products No.</th>
                      <th className="px-4 py-3 text-right">Previous Due Amount</th>
                      <th className="px-4 py-3 text-right">Order Amount</th>
                      <th className="px-4 py-3 text-right">Total Amount</th>
                      <th className="px-4 py-3 text-right">Paid Amount</th>
                      <th className="px-4 py-3 text-right">Today&apos;s Due Amount</th>
                      <th className="px-4 py-3">Order Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {orders.map((order) => {
                      const paid = orderPaid(order);
                      const previousDue = previousDueForOrder(order);
                      const fullAmount = totalAmount(previousDue, order.grandTotal);
                      return (
                      <tr className="align-top" key={order.id}>
                        <td className="px-4 py-3">
                          <div className="flex min-w-64 items-start gap-3">
                            <div className="flex gap-1.5 pt-0.5">
                              <button className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-line bg-panel2" onClick={() => setViewOrder(order)} title="View order details" type="button">
                                <Eye size={15} />
                              </button>
                              <button className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-line bg-panel2 disabled:opacity-50" disabled={order.status !== "PENDING"} onClick={() => openEditOrder(order)} title="Edit order" type="button">
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
                        <td className="px-4 py-3 text-right font-semibold">{previousDue ? formatAmount(previousDue) : "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatAmount(order.grandTotal)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatAmount(fullAmount)}</td>
                        <td className="px-4 py-3 text-right">{formatAmount(paid)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-berry">{formatAmount(todaysDueAmount(previousDue, order.grandTotal, paid))}</td>
                        <td className="px-4 py-3">{formatDate(order.dueAt || order.createdAt)}</td>
                        <td className="px-4 py-3">
                          <select
                            className={`focus-ring rounded-md border px-2 py-1 text-xs font-semibold outline-none ${orderStatusClass(order.status)}`}
                            disabled={saving}
                            onChange={(event) => updateOrderStatus(order, { status: event.target.value })}
                            value={selectableOrderStatus(order.status)}
                          >
                            {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="grid gap-2">
                            <span className={`rounded-md border px-2 py-1 text-center text-xs font-semibold ${paymentStatusClass(paymentStatus(order))}`}>{paymentStatus(order)}</span>
                            <button className="focus-ring rounded-md bg-mint px-2 py-1 text-xs font-semibold text-white disabled:opacity-50" disabled={saving || (todayDueForOrder(order) <= 0 && !order.payments?.length)} onClick={() => openPaymentEditor(order)} type="button">{order.payments?.length ? "Edit payment" : "Record payment"}</button>
                            <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                    {!loading && !orders.length ? <tr><td className="px-4 py-8 text-center text-muted" colSpan={10}>No orders found.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </section>
      </div>

      <Modal open={repeatOpen} title="Repeat orders" description="Copy all active orders from one date into another date, optionally for one route only." onClose={() => setRepeatOpen(false)}>
        <form className="grid gap-4" onSubmit={repeatOrders}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Source date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setRepeatForm((current) => ({ ...current, sourceDate: value }))} required value={repeatForm.sourceDate} /></label>
            <label className="grid gap-1 text-sm font-semibold">Target date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setRepeatForm((current) => ({ ...current, targetDate: value }))} required value={repeatForm.targetDate} /></label>
          </div>
          <SearchableSelect
            label="Route"
            onChange={(value) => setRepeatForm((current) => ({ ...current, routeId: value || "all" }))}
            options={routeOptions}
            placeholder="All routes"
            searchPlaceholder="Search routes"
            value={repeatForm.routeId === "all" ? "" : repeatForm.routeId}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setRepeatOpen(false)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Copying..." : "Repeat Orders"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={orderOpen} title="Create order" description="Select customer and product quantities. The route is taken from the customer for truck loading." onClose={() => setOrderOpen(false)}>
        <form className="grid gap-4" onSubmit={createOrder}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SearchableSelect label="Customer" onChange={(value) => setForm((current) => ({ ...current, customerId: value }))} options={customerOptions} placeholder="Select customer" required searchPlaceholder="Search customers" value={form.customerId} />
            <label className="grid gap-1 text-sm font-semibold">Order date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setForm((current) => ({ ...current, dueAt: value }))} value={form.dueAt} /></label>
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
                <p className="text-xs uppercase text-muted">Order Amount</p>
                <p className="mt-1 font-semibold">{formatAmount(viewOrder.grandTotal)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Payment</p>
                <p className="mt-1 font-semibold">{paymentStatus(viewOrder)}</p>
                <p className="text-sm text-muted">Paid Amount {formatAmount(orderPaid(viewOrder))} · Today&apos;s Due Amount {formatAmount(todayDueForOrder(viewOrder))}</p>
              </div>
            </div>

            <div className="w-full max-w-full overflow-auto rounded-lg border border-line sm:hidden">
              <div className="grid gap-3 p-3">
                {viewOrder.items.map((item) => (
                  <article className="rounded-lg border border-line bg-panel2 p-3" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{item.name}</h3>
                        <p className="mt-1 text-xs text-muted">Qty {formatQty(item.quantity)}</p>
                        <p className="mt-1 text-xs text-muted">Price {formatAmount(item.unitPrice)}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">{formatAmount(item.lineTotal)}</span>
                    </div>
                  </article>
                ))}
                {!viewOrder.items.length ? (
                  <div className="rounded-lg border border-line bg-panel2 px-4 py-8 text-center text-sm text-muted">No products in this order.</div>
                ) : null}
              </div>
            </div>
            <div className="hidden w-full max-w-full overflow-auto rounded-lg border border-line sm:block">
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
            <SearchableSelect label="Customer" onChange={(value) => setEditForm((current) => ({ ...current, customerId: value }))} options={customerOptions} placeholder="Select customer" required searchPlaceholder="Search customers" value={editForm.customerId} />
            <label className="grid gap-1 text-sm font-semibold">Order date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setEditForm((current) => ({ ...current, dueAt: value }))} value={editForm.dueAt} /></label>
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

      <Modal open={Boolean(paymentOrder)} title={paymentOrder?.payments?.length ? "Edit payment" : "Record payment"} description="Save the single payment amount for this order." onClose={() => setPaymentOrder(null)}>
        {paymentOrder ? (
          <form className="grid gap-4" onSubmit={recordPayment}>
            <div className="grid gap-3 rounded-lg border border-line bg-panel2 p-4 sm:grid-cols-5">
              <div>
                <p className="text-xs uppercase text-muted">Previous Due Amount</p>
                <p className="mt-1 font-semibold">{formatAmount(previousDueForOrder(paymentOrder))}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Order Amount</p>
                <p className="mt-1 font-semibold">{formatAmount(paymentOrder.grandTotal)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Total Amount</p>
                <p className="mt-1 font-semibold">{formatAmount(totalAmount(previousDueForOrder(paymentOrder), paymentOrder.grandTotal))}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Paid Amount</p>
                <p className="mt-1 font-semibold">{formatAmount(orderPaid(paymentOrder))}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Today&apos;s Due Amount</p>
                <p className="mt-1 font-semibold text-berry">{formatAmount(todayDueForOrder(paymentOrder))}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">
                Payment type
                <select
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => {
                    const type = event.target.value;
                    setPaymentForm((current) => ({
                      ...current,
                      type,
                      amount: type === "PARTIAL" ? "" : String(paymentAmountForType(paymentOrder, type) || "")
                    }));
                  }}
                  value={paymentForm.type}
                >
                  {paymentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Amount
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  max={paymentForm.type === "PARTIAL" ? totalAmount(previousDueForOrder(paymentOrder), paymentOrder.grandTotal) : undefined}
                  min="1"
                  onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
                  readOnly={paymentForm.type !== "PARTIAL"}
                  required
                  type="number"
                  value={paymentForm.amount}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-semibold">
                Method
                <select
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}
                  value={paymentForm.method}
                >
                  {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
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
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Payment"}</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </AppShell>
  );
}
