"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Eye, IndianRupee, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, addLocalDays, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaymentHistory, paymentDue, paymentTotal } from "../../../components/payment-history";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";
import { fetchAllProducts } from "../../../lib/catalog";

type Product = {
  id: string;
  name: string;
  categoryId?: string | null;
  category?: string | null;
  categoryRef?: { name: string } | null;
  unitPrice: string | number;
  active: boolean;
};
type Payment = { id: string; amount: string | number; method?: string | null; reference?: string | null; paidAt?: string | null };
type Order = {
  id: string;
  source: string;
  status: string;
  vehicleStatus?: string;
  paymentStatus: string;
  fulfillmentType: string;
  grandTotal: string | number;
  dueAt?: string | null;
  notes?: string | null;
  createdAt: string;
  customer: { id?: string; name: string; phone?: string | null; route?: { name: string } | null };
  route?: { name: string } | null;
  items: {
    id: string;
    productId: string;
    name: string;
    quantity: string | number;
    unitPrice?: string | number | null;
    lineTotal?: string | number | null;
    product?: { category?: string | null; categoryRef?: { name: string } | null } | null;
  }[];
  payments?: Payment[];
};
type OrderFormState = {
  dueAt: string;
  notes: string;
  items: { id: string; productId: string; quantity: string }[];
};
type CarryForwardSummary = { orders: number; previousDue: number };

const paymentMethods = ["Cash", "UPI"];
const paymentTypes = [
  { value: "PARTIAL", label: "Partial" },
  { value: "ORDER_FULL", label: "Order Full Payment" },
  { value: "DUE_FULL", label: "Due Full Payment" }
];

const today = localDateInput();
const emptyOrderForm: OrderFormState = { dueAt: today, notes: "", items: [{ id: "row-1", productId: "", quantity: "" }] };

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatQty(value?: string | number | null) {
  const amount = Number(value || 0);
  return amount ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount) : "";
}

function orderDateKey(order: Order) {
  return (order.dueAt || order.createdAt).slice(0, 10);
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

function vehicleAccepted(order: Order) {
  return order.vehicleStatus === "ACCEPTED";
}

function vehicleStatusValue(order: Order) {
  return vehicleAccepted(order) ? "ACCEPTED" : "PENDING";
}

function customerKey(order: Order) {
  return order.customer.id || order.customer.name;
}

function itemAmount(item: Order["items"][number]) {
  const lineTotal = Number(item.lineTotal ?? 0);
  if (lineTotal) return lineTotal;
  return Number(item.unitPrice || 0) * Number(item.quantity || 0);
}

function itemCategory(item: Order["items"][number]) {
  return item.product?.categoryRef?.name || item.product?.category || "-";
}

function productCategory(product: Product) {
  return product.categoryRef?.name || product.category || "General";
}

function dueByCustomer(orders: Order[]) {
  const dueByCustomer = new Map<string, number>();
  orders.forEach((order) => {
    dueByCustomer.set(customerKey(order), (dueByCustomer.get(customerKey(order)) || 0) + orderDue(order));
  });
  return dueByCustomer;
}

function latestDaySummary(orders: Order[]) {
  const latestDate = orders
    .map(orderDateKey)
    .sort((a, b) => b.localeCompare(a))[0];
  if (!latestDate) return null;
  const latestOrders = orders.filter((order) => orderDateKey(order) === latestDate);
  const olderDueByCustomer = dueByCustomer(orders.filter((order) => orderDateKey(order) < latestDate));
  return {
    orders: latestOrders.length,
    previousDue: latestOrders.reduce((sum, order) => (
      sum + todaysDueAmount(olderDueByCustomer.get(customerKey(order)) || 0, order.grandTotal, orderPaid(order))
    ), 0)
  };
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function pdfText(value: string) {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, " ");
}

function formatPdfAmount(value?: string | number | null) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function pdfLine(value: string, x: number, y: number, size = 10) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET\n`;
}

type PdfColumn = { x: number; width: number; align?: "left" | "right" };

function pdfBox(x: number, y: number, width: number, height: number, fill = false) {
  const fillCommand = fill ? `q 0.95 0.96 0.98 rg ${x} ${y} ${width} ${height} re f Q\n` : "";
  return `${fillCommand}q 0.74 0.78 0.84 RG 0.7 w ${x} ${y} ${width} ${height} re S Q\n`;
}

function pdfTableRow(values: string[], columns: PdfColumn[], topY: number, height = 20, options?: { fill?: boolean; size?: number }) {
  const size = options?.size || 9;
  const tableX = columns[0].x;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const bottomY = topY - height;
  let content = pdfBox(tableX, bottomY, tableWidth, height, options?.fill);
  let separatorX = tableX;
  columns.slice(0, -1).forEach((column) => {
    separatorX += column.width;
    content += `q 0.74 0.78 0.84 RG 0.7 w ${separatorX} ${bottomY} m ${separatorX} ${topY} l S Q\n`;
  });
  values.forEach((value, index) => {
    const column = columns[index];
    const text = value.length > 34 && column.width < 210 ? `${value.slice(0, 31)}...` : value;
    const estimatedWidth = Math.min(column.width - 10, text.length * size * 0.48);
    const textX = column.align === "right" ? column.x + column.width - 6 - estimatedWidth : column.x + 6;
    content += pdfLine(text, Math.max(column.x + 4, textX), bottomY + 7, size);
  });
  return content;
}

function buildPdf(content: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function downloadPdf(fileName: string, pdf: string) {
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function VehicleRoutesPage() {
  const toast = useToast();
  const pathname = usePathname();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [previousOrders, setPreviousOrders] = useState<Order[]>([]);
  const [carryForwardSummary, setCarryForwardSummary] = useState<CarryForwardSummary | null>(null);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<OrderFormState>(emptyOrderForm);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const pathSegments = pathname.split("/").filter(Boolean);
  const pathTenantSlug = pathSegments.length > 1 && pathSegments[1] === "vehicle" ? pathSegments[0] : "";
  const tenantSlug = pathTenantSlug || (typeof window === "undefined" ? "" : getStoredTenantSlug() || "");
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: date, endDate: date });
      const previousEndDate = localDateInput(addLocalDays(new Date(`${date}T00:00:00`), -1));
      const previousParams = new URLSearchParams({ endDate: previousEndDate, pageSize: "500" });
      params.set("_", String(Date.now()));
      previousParams.set("_", String(Date.now()));
      const [productData, data, previousData] = await Promise.all([
        fetchAllProducts<Product>(apiBase, { _: Date.now() }),
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?${params.toString()}`),
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?${previousParams.toString()}`)
      ]);
      const effectiveCarryForwardSummary = latestDaySummary(previousData.orders);
      setProducts(productData.filter((product) => product.active !== false));
      setOrders(data.orders);
      setPreviousOrders(previousData.orders);
      setCarryForwardSummary(effectiveCarryForwardSummary);
    } catch (error) {
      toast.error("Could not load assigned routes", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  const previousDueByCustomer = useMemo(() => dueByCustomer(previousOrders), [previousOrders]);

  function previousDue(order: Order) {
    return previousDueByCustomer.get(customerKey(order)) || 0;
  }

  function todayDue(order: Order) {
    return todaysDueAmount(previousDue(order), order.grandTotal, orderPaid(order));
  }

  const customerOptions = useMemo(() => {
    const customers = new Map<string, { value: string; label: string; description?: string }>();
    orders.forEach((order) => {
      const value = customerKey(order);
      if (!customers.has(value)) {
        customers.set(value, {
          value,
          label: order.customer.name,
          description: [order.customer.phone, order.route?.name || order.customer.route?.name].filter(Boolean).join(" · ") || undefined
        });
      }
    });
    return Array.from(customers.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [orders]);

  const visibleOrders = useMemo(
    () => customerFilter.length ? orders.filter((order) => customerFilter.includes(customerKey(order))) : orders,
    [customerFilter, orders]
  );

  const totals = useMemo(() => ({
    orders: visibleOrders.length || carryForwardSummary?.orders || 0,
    orderAmount: visibleOrders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
    previousDue: carryForwardSummary?.previousDue || 0,
    paid: visibleOrders.reduce((sum, order) => sum + orderPaid(order), 0)
  }), [carryForwardSummary, previousDueByCustomer, visibleOrders]);
  const todayDueTotal = Math.max(totals.orderAmount + totals.previousDue - totals.paid, 0);

  const productOptions = useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name, description: `${productCategory(product)} · ${formatAmount(product.unitPrice)}` })),
    [products]
  );

  function openEditOrder(order: Order) {
    setEditOrder(order);
    setEditForm({
      dueAt: (order.dueAt || order.createdAt).slice(0, 10),
      notes: order.notes || "",
      items: order.items.map((item) => ({ id: item.id, productId: item.productId || "", quantity: String(item.quantity) }))
    });
  }

  function updateFormItem(rowId: string, patch: Partial<{ productId: string; quantity: string }>) {
    setEditForm((current) => ({
      ...current,
      items: current.items.map((item) => item.id === rowId ? { ...item, ...patch } : item)
    }));
  }

  function addFormItem() {
    setEditForm((current) => ({ ...current, items: [{ id: `row-${Date.now()}`, productId: "", quantity: "" }, ...current.items] }));
  }

  function removeFormItem(rowId: string) {
    setEditForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((item) => item.id !== rowId) }));
  }

  async function updateOrder(order: Order, patch: { status?: string; vehicleStatus?: string; paymentStatus?: string; paymentAmount?: number; paymentMethod?: string; reference?: string }) {
    if (!apiBase) return;
    setSaving(true);
    try {
      const result = await authFetch<{ order: Order }>(`${apiBase}/orders/${order.id}/status`, { method: "PATCH", body: JSON.stringify(patch) });
      if (patch.vehicleStatus && (result.order.vehicleStatus || "PENDING") !== patch.vehicleStatus) {
        throw new Error(`Vehicle status stayed ${result.order.vehicleStatus || "PENDING"}`);
      }
      const updatedOrder = result.order;
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updatedOrder } : item));
      setPreviousOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updatedOrder } : item));
      toast.success("Order updated", `${order.customer.name} has been updated.`);
      setPaymentOrder(null);
      setPaymentForm({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Update failed", error instanceof Error ? error.message : "Could not update this order.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOrder(event: FormEvent<HTMLFormElement>) {
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
      const result = await authFetch<{ order: Order }>(`${apiBase}/orders/${editOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          source: editOrder.source,
          fulfillmentType: editOrder.fulfillmentType,
          dueAt: editForm.dueAt,
          notes: editForm.notes || undefined,
          items
        })
      });
      setOrders((current) => current.map((item) => item.id === editOrder.id ? { ...item, ...result.order } : item));
      toast.success("Order updated", `${editOrder.customer.name} order was recalculated.`);
      setEditOrder(null);
      await loadData();
    } catch (error) {
      toast.error("Order update failed", error instanceof Error ? error.message : "Could not update this order.");
    } finally {
      setSaving(false);
    }
  }

  function paymentAmountForType(order: Order, type: string) {
    if (type === "ORDER_FULL") return Number(order.grandTotal || 0);
    if (type === "DUE_FULL") return todayDue(order);
    return 0;
  }

  function startPayment(order: Order, type = "PARTIAL") {
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
    if (!apiBase || !paymentOrder?.customer.id) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/orders/customers/${paymentOrder.customer.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          mode: paymentForm.type,
          orderId: paymentOrder.id,
          date,
          amount: paymentForm.type === "PARTIAL" ? Number(paymentForm.amount) : undefined,
          method: paymentForm.method,
          reference: paymentForm.reference || undefined
        })
      });
      toast.success("Payment recorded", `${paymentOrder.customer.name} payment was saved.`);
      setPaymentOrder(null);
      setPaymentForm({ type: "PARTIAL", amount: "", method: "Cash", reference: "" });
      await loadData();
    } catch (error) {
      toast.error("Payment failed", error instanceof Error ? error.message : "Could not record this payment.");
    } finally {
      setSaving(false);
    }
  }

  function exportCollectionSheet() {
    const headers = ["Customer", "Phone", "Order Amount", "Previous Due Amount", "Paid Amount", "Today's Due Amount", "Payment Method", "Reference"];
    const rows = visibleOrders.map((order) => [
      order.customer.name,
      order.customer.phone || "",
      Number(order.grandTotal || 0),
      previousDue(order),
      orderPaid(order),
      todayDue(order),
      "",
      ""
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vehicle-collection-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportOrderPdf(order: Order) {
    const orderNumber = `Order ${order.id.slice(-6).toUpperCase()}`;
    const previousDueAmount = previousDue(order);
    const orderAmount = Number(order.grandTotal || 0);
    const paidAmount = orderPaid(order);
    const todaysDue = todayDue(order);
    const productColumns: PdfColumn[] = [
      { x: 48, width: 250 },
      { x: 298, width: 58, align: "right" },
      { x: 356, width: 88, align: "right" },
      { x: 444, width: 103, align: "right" }
    ];
    const totalColumns: PdfColumn[] = [
      { x: 298, width: 150 },
      { x: 448, width: 99, align: "right" }
    ];
    const paymentColumns: PdfColumn[] = [
      { x: 48, width: 132 },
      { x: 180, width: 100 },
      { x: 280, width: 168 },
      { x: 448, width: 99, align: "right" }
    ];
    let y = 800;
    let content = "";
    content += pdfLine(orderNumber, 48, y, 18); y -= 22;
    content += pdfLine(order.customer.name, 48, y, 10);
    content += pdfLine(`Order date: ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(order.dueAt || order.createdAt))}`, 360, y, 9); y -= 16;
    content += pdfLine(`Vehicle status: ${vehicleAccepted(order) ? "Accepted" : "Pending"}`, 360, y, 9);
    content += pdfLine(`Bakery status: ${order.status}`, 360, y - 14, 9);
    content += pdfLine(`Payment status: ${order.paymentStatus}`, 360, y - 28, 9); y -= 50;
    content += pdfLine("Products", 48, y, 13); y -= 18;
    content += pdfTableRow(["Product", "Qty", "Price", "Total"], productColumns, y, 22, { fill: true, size: 9 });
    y -= 22;
    order.items.slice(0, 16).forEach((item) => {
      content += pdfTableRow([
        item.name,
        formatQty(item.quantity),
        formatPdfAmount(item.unitPrice),
        formatPdfAmount(itemAmount(item))
      ], productColumns, y, 20, { size: 9 });
      y -= 20;
    });
    if (order.items.length > 16) {
      content += pdfTableRow([`Plus ${order.items.length - 16} more item(s)`, "", "", ""], productColumns, y, 20, { size: 9 });
      y -= 20;
    }
    y -= 22;
    content += pdfLine("Totals", 298, y, 13); y -= 18;
    content += pdfTableRow(["Description", "Amount"], totalColumns, y, 22, { fill: true, size: 9 });
    y -= 22;
    [
      ["Order Amount", orderAmount],
      ["Previous Due Amount", previousDueAmount],
      ["Paid Amount", paidAmount],
      ["Today's Due Amount", todaysDue]
    ].forEach(([label, value]) => {
      content += pdfTableRow([String(label), formatPdfAmount(value as number)], totalColumns, y, 20, { size: 9 });
      y -= 20;
    });
    y -= 24;
    content += pdfLine("Payment History", 48, y, 13); y -= 18;
    const payments = order.payments || [];
    content += pdfTableRow(["Date", "Method", "Reference", "Amount"], paymentColumns, y, 22, { fill: true, size: 9 });
    y -= 22;
    if (!payments.length) {
      content += pdfTableRow(["No payment recorded.", "", "", ""], paymentColumns, y, 20, { size: 9 });
    } else {
      payments.slice(0, 8).forEach((payment, index) => {
        content += pdfTableRow([
          payment.paidAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(payment.paidAt)) : "-",
          payment.method || "Cash",
          payment.reference || `Payment ${index + 1}`,
          formatPdfAmount(payment.amount)
        ], paymentColumns, y, 20, { size: 9 });
        y -= 20;
      });
    }
    const fileName = `${orderNumber.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.pdf`;
    downloadPdf(fileName, buildPdf(content));
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Assigned customers, deliveries, and collections" surface="vehicle">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Customers</h1>
              <p className="mt-1 text-sm text-muted">Only customers assigned to this vehicle are visible for the selected date.</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              <span>Orders: <span className="font-semibold text-ink">{totals.orders}</span></span>
              <span>Order Amount: <span className="font-semibold text-ink">{formatAmount(totals.orderAmount)}</span></span>
              <span>Previous Due Amount: <span className="font-semibold text-ink">{formatAmount(totals.previousDue)}</span></span>
              <span>Paid Amount: <span className="font-semibold text-ink">{formatAmount(totals.paid)}</span></span>
              <span>Today&apos;s Due Amount: <span className="font-semibold text-ink">{formatAmount(todayDueTotal)}</span></span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_auto_auto]">
              <SearchableSelect className="min-w-0" multiple onChange={setCustomerFilter} options={customerOptions} placeholder="All customers" searchPlaceholder="Search customers" value={customerFilter} />
              <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={setDate} value={date} />
              <button className="focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-line bg-panel2 px-3 text-sm font-semibold" disabled={!visibleOrders.length} onClick={exportCollectionSheet} type="button"><Download size={16} /> Export</button>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
            </div>
          </div>
          {loading ? <LoadingSpinner label="Loading assigned orders" /> : null}
          <div className="grid gap-3 p-3 sm:hidden">
            {visibleOrders.map((order) => (
              <article className="rounded-lg border border-line bg-panel2 p-3" key={order.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{order.customer.name}</h2>
                    <p className="mt-1 truncate text-xs text-muted">{order.customer.phone || "No phone"}</p>
                    <p className="mt-1 truncate text-xs text-muted">{order.route?.name || order.customer.route?.name || "Assigned route"}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-line bg-panel px-2 py-1 text-xs font-semibold">{order.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                  <span className="rounded-md bg-panel p-2">Order Amount<br /><strong className="text-ink">{formatAmount(order.grandTotal)}</strong></span>
                  <span className="rounded-md bg-panel p-2">Previous Due<br /><strong className="text-ink">{formatAmount(previousDue(order))}</strong></span>
                  <span className="rounded-md bg-panel p-2">Paid Amount<br /><strong className="text-ink">{formatAmount(orderPaid(order))}</strong></span>
                  <span className="rounded-md bg-panel p-2">Today&apos;s Due<br /><strong className="text-berry">{formatAmount(todayDue(order))}</strong></span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                  <button className="focus-ring inline-flex items-center justify-center gap-1 rounded-md border border-line bg-panel px-3 py-2 text-xs font-semibold" onClick={() => setDetailOrder(order)} type="button"><Eye size={14} /> Details</button>
                  <button className="focus-ring inline-flex items-center justify-center gap-1 rounded-md border border-line bg-panel px-3 py-2 text-xs font-semibold" onClick={() => exportOrderPdf(order)} type="button"><Download size={14} /> Invoice PDF</button>
                  <button className="focus-ring inline-flex items-center justify-center gap-1 rounded-md border border-line bg-panel px-3 py-2 text-xs font-semibold" disabled={saving} onClick={() => openEditOrder(order)} type="button"><Pencil size={14} /> Edit</button>
                  <select
                    className={`focus-ring col-span-2 rounded-md border px-3 py-2 text-xs font-semibold outline-none ${vehicleAccepted(order) ? "border-mint/30 bg-mint/10 text-mint" : "border-amber-400/40 bg-amber-100 text-amber-700"}`}
                    disabled={saving}
                    onChange={(event) => updateOrder(order, { vehicleStatus: event.target.value })}
                    value={vehicleStatusValue(order)}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="ACCEPTED">Accepted</option>
                  </select>
                  <button className="focus-ring col-span-2 rounded-md bg-mint px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={saving || (todayDue(order) <= 0 && !order.payments?.length)} onClick={() => startPayment(order)} type="button">{order.payments?.length ? "Edit payment" : "Record payment"}</button>
                </div>
              </article>
            ))}
            {!loading && !visibleOrders.length ? (
              <div className="rounded-lg border border-line bg-panel2 px-4 py-8 text-center text-sm text-muted">No customers for this date.</div>
            ) : null}
          </div>
          <div className="hidden max-h-[700px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Order Amount</th>
                  <th className="px-4 py-3 text-right">Previous Due Amount</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Today's Due Amount</th>
                  <th className="px-4 py-3">Bakery Status</th>
                  <th className="table-action-cell px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleOrders.map((order) => (
                    <tr className="align-top" key={order.id}>
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{order.customer.name}</span>
                        <span className="text-xs text-muted">{order.customer.phone || "No phone"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(order.grandTotal)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(previousDue(order))}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(orderPaid(order))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-berry">{formatAmount(todayDue(order))}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-md border border-line bg-panel2 px-2 py-1 text-xs font-semibold">{order.status}</span>
                      </td>
                      <td className="table-action-cell px-4 py-3">
                        <div className="table-action-grid">
                          <PaymentHistory compact iconOnly payments={order.payments} total={order.grandTotal} />
                          <button aria-label="Order details" className="focus-ring grid place-items-center rounded-md border border-line bg-panel2" onClick={() => setDetailOrder(order)} title="Order details" type="button"><Eye size={14} /></button>
                          <button aria-label="Invoice PDF" className="focus-ring grid place-items-center rounded-md border border-line bg-panel2" onClick={() => exportOrderPdf(order)} title="Invoice PDF" type="button"><Download size={14} /></button>
                          <button aria-label="Edit order" className="focus-ring grid place-items-center rounded-md border border-line bg-panel2 disabled:opacity-50" disabled={saving} onClick={() => openEditOrder(order)} title="Edit order" type="button"><Pencil size={14} /></button>
                          <select
                            className={`focus-ring rounded-md border px-3 py-2 text-xs font-semibold outline-none ${vehicleAccepted(order) ? "border-mint/30 bg-mint/10 text-mint" : "border-amber-400/40 bg-amber-100 text-amber-700"}`}
                            disabled={saving}
                            onChange={(event) => updateOrder(order, { vehicleStatus: event.target.value })}
                            value={vehicleStatusValue(order)}
                          >
                            <option value="PENDING">Pending</option>
                            <option value="ACCEPTED">Accepted</option>
                          </select>
                          <button aria-label={order.payments?.length ? "Edit payment" : "Record payment"} className="focus-ring grid place-items-center rounded-md bg-mint text-white disabled:opacity-50" disabled={saving || (todayDue(order) <= 0 && !order.payments?.length)} onClick={() => startPayment(order)} title={order.payments?.length ? "Edit payment" : "Record payment"} type="button"><IndianRupee size={15} /></button>
                        </div>
                      </td>
                    </tr>
                ))}
                {!loading && !visibleOrders.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-muted" colSpan={7}>No customers for this date.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={Boolean(editOrder)} title="Edit order" description={editOrder ? `${editOrder.customer.name} · Vehicle can edit accepted orders` : ""} onClose={() => setEditOrder(null)}>
        {editOrder ? (
          <form className="grid gap-4" onSubmit={saveOrder}>
            <label className="grid gap-1 text-sm font-semibold">Order date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setEditForm((current) => ({ ...current, dueAt: value }))} value={editForm.dueAt} /></label>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Products</p>
                <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold" onClick={addFormItem} type="button"><Plus size={15} /> Add Product</button>
              </div>
              {editForm.items.map((item) => {
                const orderItem = editOrder.items.find((candidate) => candidate.id === item.id || candidate.productId === item.productId);
                const selectedProduct = products.find((product) => product.id === item.productId);
                const selectedOptions = item.productId
                  ? [{
                      value: item.productId,
                      label: selectedProduct?.name || orderItem?.name || "Selected product",
                      description: selectedProduct ? `${productCategory(selectedProduct)} · ${formatAmount(selectedProduct.unitPrice)}` : item.productId
                    }]
                  : [];
                return (
                  <div className="grid gap-2 rounded-md border border-line bg-panel2 p-3 sm:grid-cols-[minmax(0,1fr)_120px_40px]" key={item.id}>
                    <SearchableSelect
                      className="min-w-0"
                      onChange={(value) => updateFormItem(item.id, { productId: value })}
                      options={productOptions}
                      placeholder="Select product"
                      required
                      searchPlaceholder="Search products"
                      selectedOptions={selectedOptions}
                      value={item.productId}
                    />
                    <input className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" min="0.001" onChange={(event) => updateFormItem(item.id, { quantity: event.target.value })} placeholder="Qty" required step="0.001" type="number" value={item.quantity} />
                    <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel" disabled={editForm.items.length === 1} onClick={() => removeFormItem(item.id)} title="Remove product" type="button"><Trash2 size={16} /></button>
                  </div>
                );
              })}
            </div>
            <label className="grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} value={editForm.notes} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setEditOrder(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Order"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(paymentOrder)} title={paymentOrder?.payments?.length ? "Edit payment" : "Record payment"} description="Save the single payment amount for this order." onClose={() => setPaymentOrder(null)}>
        {paymentOrder ? (
          <form className="grid gap-4" onSubmit={recordPayment}>
            <label className="grid gap-1 text-sm font-semibold">Payment type<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => {
              const type = event.target.value;
              setPaymentForm((current) => ({
                ...current,
                type,
                amount: type === "PARTIAL" ? "" : String(paymentAmountForType(paymentOrder, type) || ""),
                method: current.method
              }));
            }} value={paymentForm.type}>{paymentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Amount<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" max={paymentForm.type === "PARTIAL" ? totalAmount(previousDue(paymentOrder), paymentOrder.grandTotal) : undefined} min="1" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} readOnly={paymentForm.type !== "PARTIAL"} required type="number" value={paymentForm.amount} /></label>
            <label className="grid gap-1 text-sm font-semibold">Payment method<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))} value={paymentForm.method}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Reference<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} value={paymentForm.reference} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setPaymentOrder(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Payment"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(detailOrder)} title="Order details" description={detailOrder ? detailOrder.customer.name : ""} onClose={() => setDetailOrder(null)}>
        {detailOrder ? (
          <>
            <div className="max-h-[560px] overflow-auto rounded-lg border border-line sm:hidden">
              <div className="grid gap-3 p-3">
                {detailOrder.items.map((item) => (
                  <article className="rounded-lg border border-line bg-panel2 p-3" key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{item.name}</h3>
                        <p className="mt-1 text-xs text-muted">{itemCategory(item)}</p>
                        <p className="mt-1 text-xs text-muted">Qty {formatQty(item.quantity) || "0"}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">{formatAmount(itemAmount(item))}</span>
                    </div>
                  </article>
                ))}
                <div className="rounded-lg border border-line bg-panel2 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>Total</span>
                    <span>{formatAmount(detailOrder.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden max-h-[560px] overflow-auto rounded-lg border border-line sm:block">
              <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Order Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {detailOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-semibold">{item.name}</td>
                    <td className="px-4 py-3 text-muted">{itemCategory(item)}</td>
                    <td className="px-4 py-3 text-right">{formatQty(item.quantity) || "0"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAmount(itemAmount(item))}</td>
                  </tr>
                ))}
                <tr className="bg-panel2 font-semibold">
                  <td className="px-4 py-3" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right">{formatAmount(detailOrder.grandTotal)}</td>
                </tr>
              </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={() => exportOrderPdf(detailOrder)} type="button"><Download size={15} /> Download PDF</button>
            </div>
          </>
        ) : null}
      </Modal>
    </AppShell>
  );
}
