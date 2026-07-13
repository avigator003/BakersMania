"use client";

import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Eye, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaymentHistory } from "../../../components/payment-history";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Product = {
  id: string;
  name: string;
  category: string;
  categoryId?: string | null;
  categoryRef?: { id: string; name: string } | null;
  unitPrice: string | number;
  active: boolean;
};
type Category = { id: string; name: string; active?: boolean };
type Payment = { id: string; amount: string | number; method?: string | null; reference?: string | null; paidAt?: string | null };
type OrderItem = {
  id: string;
  productId: string;
  name: string;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
  product?: { id: string; category?: string | null; categoryId?: string | null; categoryRef?: { id: string; name: string } | null } | null;
};
type Order = {
  id: string;
  source: string;
  status: string;
  vehicleStatus?: string | null;
  paymentStatus: string;
  fulfillmentType: string;
  grandTotal: string | number;
  dueAt?: string | null;
  notes?: string | null;
  createdAt: string;
  invoice?: { invoiceNumber: string; paymentStatus: string; total: string | number } | null;
  items: OrderItem[];
  payments?: Payment[];
};
type OrderFormState = {
  dueAt: string;
  notes: string;
  items: { id: string; productId: string; quantity: string }[];
};
type DaySummary = {
  previousDue: number;
  todayOrderAmount: number;
  todayPaid: number;
  todaysDue: number;
  totalDue: number;
};

const today = localDateInput();
const emptyOrderForm: OrderFormState = { dueAt: today, notes: "", items: [{ id: "row-1", productId: "", quantity: "" }] };

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatQty(value?: string | number | null) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

function paid(order: Order) {
  return (order.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function due(order: Order) {
  return Math.max(Number(order.grandTotal || 0) - paid(order), 0);
}

function driverAccepted(order: Order) {
  return order.vehicleStatus === "ACCEPTED";
}

function totalAmount(previousDue: number, orderAmount: string | number) {
  return Number(previousDue || 0) + Number(orderAmount || 0);
}

function todaysDueAmount(previousDue: number, orderAmount: string | number, paidAmount: string | number) {
  return Math.max(totalAmount(previousDue, orderAmount) - Number(paidAmount || 0), 0);
}

function productCategory(product: Product) {
  return product.categoryRef?.name || product.category || "General";
}

function itemCategory(item: OrderItem) {
  return item.product?.categoryRef?.name || item.product?.category || "General";
}

function itemCategoryId(item: OrderItem) {
  return item.product?.categoryRef?.id || item.product?.categoryId || "";
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

export default function CustomerOrdersPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [date, setDate] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<OrderFormState>(emptyOrderForm);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const categoryOptions = useMemo(
    () => categories.filter((category) => category.active !== false).map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const productOptions = useMemo(
    () => products.map((product) => ({ value: product.id, label: product.name, description: `${productCategory(product)} · ${formatAmount(product.unitPrice)}` })),
    [products]
  );

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const cacheKey = String(Date.now());
      const [productData, categoryData, orderData, summaryData] = await Promise.all([
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products?pageSize=500&_=${cacheKey}`),
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories?_=${cacheKey}`),
        authFetch<{ orders: Order[] }>(`${apiBase}/orders?startDate=${date}&endDate=${date}&pageSize=100&_=${cacheKey}`),
        authFetch<{ summary: DaySummary }>(`${apiBase}/orders/customer-day-summary?date=${date}&_=${cacheKey}`)
      ]);
      setProducts(productData.products.filter((product) => product.active !== false));
      setCategories(categoryData.categories);
      setOrders(orderData.orders);
      setSummary(summaryData.summary);
    } catch (error) {
      toast.error("Could not load orders", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  const rows = useMemo(() => orders.flatMap((order) => order.items.map((item) => ({
    order,
    item,
    category: itemCategory(item),
    categoryId: itemCategoryId(item),
    paidAmount: paid(order),
    dueAmount: due(order)
  }))).filter((row) => {
    if (categoryFilter && row.categoryId !== categoryFilter) return false;
    if (productFilter && row.item.product?.id !== productFilter) return false;
    return true;
  }), [categoryFilter, orders, productFilter]);

  const orderGroups = useMemo(() => Array.from(rows.reduce((map, row) => {
    const group = map.get(row.order.id) || { order: row.order, rows: [] as typeof rows };
    group.rows.push(row);
    map.set(row.order.id, group);
    return map;
  }, new Map<string, { order: Order; rows: typeof rows }>()).values()), [rows]);

  const totals = useMemo(() => {
    const uniqueOrders = Array.from(new Map(rows.map((row) => [row.order.id, row.order])).values());
    const previousDue = summary?.previousDue || 0;
    const orderAmount = rows.reduce((sum, row) => sum + Number(row.item.lineTotal || 0), 0);
    const paidAmount = uniqueOrders.reduce((sum, order) => sum + paid(order), 0);
    return {
      products: rows.length,
      quantity: rows.reduce((sum, row) => sum + Number(row.item.quantity || 0), 0),
      previousDue,
      orderAmount,
      paid: paidAmount,
      todaysDue: todaysDueAmount(previousDue, orderAmount, paidAmount)
    };
  }, [rows, summary]);

  function openEditOrder(order: Order) {
    setEditOrder(order);
    setEditForm({
      dueAt: (order.dueAt || order.createdAt).slice(0, 10),
      notes: order.notes || "",
      items: order.items.map((item) => ({ id: item.id, productId: item.productId || item.product?.id || "", quantity: String(item.quantity) }))
    });
  }

  function exportOrder(order: Order) {
    const invoiceNumber = order.invoice?.invoiceNumber || `Order ${order.id.slice(-6).toUpperCase()}`;
    const previousDueAmount = totals.previousDue;
    const orderAmount = Number(order.grandTotal || 0);
    const paidAmount = paid(order);
    const todaysDue = todaysDueAmount(previousDueAmount, orderAmount, paidAmount);
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
    content += pdfLine(invoiceNumber, 48, y, 18); y -= 22;
    content += pdfLine(`Order ${order.id}`, 48, y, 9);
    content += pdfLine(`Order date: ${formatDate(order.dueAt || order.createdAt)}`, 360, y, 9); y -= 16;
    content += pdfLine(`Payment status: ${order.invoice?.paymentStatus || order.paymentStatus}`, 360, y, 9); y -= 30;
    content += pdfLine("Products", 48, y, 13); y -= 18;
    content += pdfTableRow(["Product", "Qty", "Price", "Total"], productColumns, y, 22, { fill: true, size: 9 });
    y -= 22;
    order.items.slice(0, 16).forEach((item) => {
      content += pdfTableRow([
        item.name,
        formatQty(item.quantity),
        formatPdfAmount(item.unitPrice),
        formatPdfAmount(item.lineTotal)
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
          formatDate(payment.paidAt),
          payment.method || "Cash",
          payment.reference || `Payment ${index + 1}`,
          formatPdfAmount(payment.amount)
        ], paymentColumns, y, 20, { size: 9 });
        y -= 20;
      });
    }
    const fileName = `${invoiceNumber.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.pdf`;
    downloadPdf(fileName, buildPdf(content));
  }

  function updateFormItem(rowId: string, patch: Partial<{ productId: string; quantity: string }>) {
    setEditForm((current) => ({
      ...current,
      items: current.items.map((item) => item.id === rowId ? { ...item, ...patch } : item)
    }));
  }

  function addFormItem() {
    setEditForm((current) => ({ ...current, items: [...current.items, { id: `row-${Date.now()}`, productId: "", quantity: "" }] }));
  }

  function removeFormItem(rowId: string) {
    setEditForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((item) => item.id !== rowId) }));
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
          source: editOrder.source,
          fulfillmentType: editOrder.fulfillmentType,
          dueAt: editForm.dueAt,
          notes: editForm.notes || undefined,
          items
        })
      });
      toast.success("Order updated", "Pending order quantities were recalculated.");
      setEditOrder(null);
      await loadData();
    } catch (error) {
      toast.error("Order update failed", error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Customer Portal" subtitle="Orders, dues, and payments" surface="customer">
      <section className="rounded-lg border border-line bg-panel shadow-subtle">
        <div className="border-b border-line p-4">
          <div className="grid gap-3 md:grid-cols-[150px_minmax(180px,1fr)_minmax(180px,1fr)_40px] md:items-end">
            <label className="grid gap-1 text-sm font-semibold">Date<DateInput className="h-10 rounded-md border border-line bg-panel2 px-3 outline-none focus:border-mint" onChange={setDate} value={date} /></label>
            <SearchableSelect className="min-w-0" onChange={setCategoryFilter} options={categoryOptions} placeholder="All categories" searchPlaceholder="Search categories" value={categoryFilter} />
            <SearchableSelect className="min-w-0" onChange={setProductFilter} options={productOptions} placeholder="All products" searchPlaceholder="Search products" value={productFilter} />
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
          </div>
        </div>
        {loading ? <LoadingSpinner label="Loading orders" /> : null}
        <div className="grid gap-2 border-b border-line p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <span className="rounded-md bg-panel2 p-3">Products<br /><strong>{totals.products}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Quantity<br /><strong>{formatQty(totals.quantity)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Order Amount<br /><strong>{formatAmount(totals.orderAmount)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Previous Due Amount<br /><strong>{formatAmount(totals.previousDue)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Paid Amount<br /><strong>{formatAmount(totals.paid)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Today&apos;s Due Amount<br /><strong>{formatAmount(totals.todaysDue)}</strong></span>
        </div>
        <div className="max-h-[calc(100vh-360px)] w-full max-w-full overflow-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Order Amount</th>
                <th className="px-4 py-3 text-right">Previous Due Amount</th>
                <th className="px-4 py-3 text-right">Paid Amount</th>
                <th className="px-4 py-3 text-right">Today&apos;s Due Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orderGroups.map(({ order, rows: orderRows }) => (
                <Fragment key={order.id}>
                  <tr className="bg-panel2/70">
                    <td className="px-4 py-3" colSpan={7}>
                      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(0,auto)] lg:items-center">
                        <div>
                          <p className="font-semibold">{order.invoice?.invoiceNumber || `Order ${order.id.slice(-6).toUpperCase()}`}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-muted">{formatDate(order.dueAt || order.createdAt)} · {order.invoice?.paymentStatus || order.paymentStatus}</span>
                            <span className={`rounded-md border px-2 py-1 font-semibold ${driverAccepted(order) ? "border-mint/30 bg-mint/10 text-mint" : "border-amber-400/40 bg-amber-100 text-amber-700"}`}>
                              {driverAccepted(order) ? "Accepted by driver" : "Pending by driver"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-start lg:pr-10">
                          <PaymentHistory compact payments={order.payments} total={order.grandTotal} />
                          <button
                            className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel px-3 py-2 text-xs font-semibold"
                            onClick={() => setDetailOrder(order)}
                            title="Show invoice details"
                            type="button"
                          >
                            <Eye size={14} /> Details
                          </button>
                          <button
                            className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel px-3 py-2 text-xs font-semibold"
                            onClick={() => exportOrder(order)}
                            title="Download invoice"
                            type="button"
                          >
                            <Download size={14} /> Invoice PDF
                          </button>
                          <button
                            className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel px-3 py-2 text-xs font-semibold disabled:opacity-50"
                            disabled={saving || order.status !== "PENDING" || driverAccepted(order)}
                            onClick={() => openEditOrder(order)}
                            title={driverAccepted(order) ? "Cannot edit after driver accepts" : order.status === "PENDING" ? "Edit order" : `Cannot edit ${order.status.toLowerCase()} order`}
                            type="button"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {orderRows.map((row) => (
                    <tr key={`${row.order.id}-${row.item.id}`}>
                      <td className="px-4 py-3 font-semibold">{row.item.name}</td>
                      <td className="px-4 py-3 text-muted">{row.category}</td>
                      <td className="px-4 py-3 text-right">{formatQty(row.item.quantity)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(row.item.lineTotal)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(totals.previousDue)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(row.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(todaysDueAmount(totals.previousDue, row.item.lineTotal, row.paidAmount))}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {!loading && !rows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={7}>No products found for this date/filter.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={Boolean(editOrder)} title="Edit pending order" description="Pending orders can be changed until the bakery or vehicle accepts them." onClose={() => setEditOrder(null)}>
        {editOrder ? (
          <form className="grid gap-4" onSubmit={updateOrder}>
            <label className="grid gap-1 text-sm font-semibold">Order date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setEditForm((current) => ({ ...current, dueAt: value }))} value={editForm.dueAt} /></label>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Products</p>
                <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold" onClick={addFormItem} type="button"><Plus size={15} /> Add Product</button>
              </div>
              {editForm.items.map((item) => (
                <div className="grid gap-2 rounded-md border border-line bg-panel2 p-3 sm:grid-cols-[1fr_120px_40px]" key={item.id}>
                  <select className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" onChange={(event) => updateFormItem(item.id, { productId: event.target.value })} required value={item.productId}>
                    <option value="">Select product</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatAmount(product.unitPrice)}</option>)}
                  </select>
                  <input className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" min="0.001" onChange={(event) => updateFormItem(item.id, { quantity: event.target.value })} placeholder="Qty" required step="0.001" type="number" value={item.quantity} />
                  <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel" disabled={editForm.items.length === 1} onClick={() => removeFormItem(item.id)} title="Remove product" type="button"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <label className="grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} value={editForm.notes} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setEditOrder(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Order"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(detailOrder)} title="Invoice details" description={detailOrder?.invoice?.invoiceNumber || (detailOrder ? `Order ${detailOrder.id.slice(-6).toUpperCase()}` : "")} onClose={() => setDetailOrder(null)}>
        {detailOrder ? (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-lg border border-line bg-panel2 p-4 sm:grid-cols-4">
              <span>Order Amount<br /><strong>{formatAmount(detailOrder.grandTotal)}</strong></span>
              <span>Previous Due Amount<br /><strong>{formatAmount(totals.previousDue)}</strong></span>
              <span>Paid Amount<br /><strong>{formatAmount(paid(detailOrder))}</strong></span>
              <span>Today&apos;s Due Amount<br /><strong>{formatAmount(todaysDueAmount(totals.previousDue, detailOrder.grandTotal, paid(detailOrder)))}</strong></span>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 bg-panel2 text-xs uppercase text-muted">
                  <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {detailOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold">{item.name}</td>
                      <td className="px-4 py-3 text-right">{formatQty(item.quantity)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaymentHistory payments={detailOrder.payments} total={detailOrder.grandTotal} />
            <div className="flex flex-wrap justify-end gap-2">
              <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={() => exportOrder(detailOrder)} type="button"><Download size={15} /> Download PDF</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
