"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Eye, Lock, PackageSearch, RefreshCw, Unlock, Users } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type RouteInvoiceRow = {
  routeId: string;
  routeName: string;
  customerCount: number;
  pricedProductCount: number;
  orderAmount: number;
  oldDue: number;
  paidAmount: number;
  totalDue: number;
  locked?: boolean;
};

type RouteInvoiceResponse = {
  routeInvoices: {
    date: string;
    totals: Omit<RouteInvoiceRow, "routeId" | "routeName"> & { routes: number; customers: number; pricedProducts: number };
    rows: RouteInvoiceRow[];
  };
};

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  routeId?: string | null;
  dueBalance?: number;
};

type RoutePrice = {
  id: string;
  price: string | number;
  product: {
    id: string;
    name: string;
    category?: string | null;
    categoryRef?: { name: string } | null;
    unitPrice: string | number;
  };
};

const today = localDateInput();
const paymentMethods = ["Cash", "UPI"];
const paymentTypes = [
  { value: "PARTIAL", label: "Partial" },
  { value: "ORDER_FULL", label: "Order Full Payment" },
  { value: "DUE_FULL", label: "Due Full Payment" }
];

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatPdfAmount(value?: string | number | null) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function totalAmount(previousDue: number, orderAmount: number) {
  return Number(previousDue || 0) + Number(orderAmount || 0);
}

function todaysDueAmount(previousDue: number, orderAmount: number, paidAmount: number) {
  return Math.max(totalAmount(previousDue, orderAmount) - Number(paidAmount || 0), 0);
}

function productCategory(price: RoutePrice) {
  return price.product.categoryRef?.name || price.product.category || "General";
}

function pdfText(value: string) {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, " ");
}

function pdfLine(value: string, x: number, y: number, size = 10) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET\n`;
}

function pdfBox(x: number, y: number, width: number, height: number, fill = false) {
  const fillCommand = fill ? `q 0.95 0.96 0.98 rg ${x} ${y} ${width} ${height} re f Q\n` : "";
  return `${fillCommand}q 0.74 0.78 0.84 RG 0.7 w ${x} ${y} ${width} ${height} re S Q\n`;
}

function pdfSummaryRow(label: string, value: string, topY: number) {
  const bottomY = topY - 26;
  return [
    pdfBox(48, bottomY, 310, 26),
    pdfBox(358, bottomY, 188, 26, true),
    pdfLine(label, 60, bottomY + 9, 10),
    pdfLine(value, 370, bottomY + 9, 10)
  ].join("");
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

function routeInvoicePdf(row: RouteInvoiceRow, date: string) {
  const total = totalAmount(row.oldDue, row.orderAmount);
  const due = todaysDueAmount(row.oldDue, row.orderAmount, row.paidAmount);
  let content = "";
  content += pdfLine("Route Invoice", 48, 792, 18);
  content += pdfLine(`Route: ${row.routeName}`, 48, 765, 12);
  content += pdfLine(`Date: ${date}`, 48, 746, 10);
  content += pdfLine("BakersMania", 452, 792, 12);
  content += pdfLine("Route invoice summary", 420, 774, 9);

  const rows = [
    ["Customers", String(row.customerCount)],
    ["Priced Products", String(row.pricedProductCount)],
    ["Previous Due Amount", formatPdfAmount(row.oldDue)],
    ["Order Amount", formatPdfAmount(row.orderAmount)],
    ["Total Amount", formatPdfAmount(total)],
    ["Paid Amount", formatPdfAmount(row.paidAmount)],
    ["Today's Due Amount", formatPdfAmount(due)]
  ];
  let y = 700;
  rows.forEach(([label, value]) => {
    content += pdfSummaryRow(label, value, y);
    y -= 32;
  });
  content += pdfLine("Generated from Route Invoices", 48, 72, 9);
  return buildPdf(content);
}

function safeFilePart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "route";
}

export default function RouteInvoicesPage() {
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<RouteInvoiceRow[]>([]);
  const [routeSearch, setRouteSearch] = useState("");
  const [totals, setTotals] = useState<RouteInvoiceResponse["routeInvoices"]["totals"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentRoute, setPaymentRoute] = useState<RouteInvoiceRow | null>(null);
  const [paymentForm, setPaymentForm] = useState({ type: "DUE_FULL", amount: "", method: "Cash", reference: "" });
  const [customerRoute, setCustomerRoute] = useState<RouteInvoiceRow | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productsRoute, setProductsRoute] = useState<RouteInvoiceRow | null>(null);
  const [routePrices, setRoutePrices] = useState<RoutePrice[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const data = await authFetch<RouteInvoiceResponse>(`${apiBase}/orders/route-invoices?date=${date}`);
      setRows(data.routeInvoices.rows);
      setTotals(data.routeInvoices.totals);
    } catch (error) {
      toast.error("Could not load route invoices", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  const selectedRouteCustomers = useMemo(
    () => customers.filter((customer) => customer.routeId === customerRoute?.routeId),
    [customerRoute?.routeId, customers]
  );

  const visibleRows = useMemo(() => {
    const query = routeSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.routeName.toLowerCase().includes(query));
  }, [routeSearch, rows]);

  function openPayment(row: RouteInvoiceRow) {
    setPaymentRoute(row);
    const todaysDue = todaysDueAmount(row.oldDue, row.orderAmount, row.paidAmount);
    setPaymentForm({ type: "DUE_FULL", amount: todaysDue ? String(todaysDue) : "", method: "Cash", reference: "" });
  }

  function paymentAmountForType(row: RouteInvoiceRow, type: string) {
    const todaysDue = todaysDueAmount(row.oldDue, row.orderAmount, row.paidAmount);
    if (type === "ORDER_FULL") return Math.min(Number(row.orderAmount || 0), todaysDue);
    if (type === "DUE_FULL") return todaysDue;
    return Number(paymentForm.amount || 0);
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !paymentRoute) return;
    setSaving(true);
    try {
      const data = await authFetch<{ result: { appliedAmount: number; unappliedAmount: number } }>(`${apiBase}/orders/route-invoices/${paymentRoute.routeId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentForm.amount || 0),
          method: paymentForm.method,
          reference: paymentForm.reference || undefined
        })
      });
      toast.success("Payment recorded", `${formatAmount(data.result.appliedAmount)} applied to ${paymentRoute.routeName}.`);
      if (data.result.unappliedAmount > 0) {
        toast.error("Amount left unapplied", `${formatAmount(data.result.unappliedAmount)} had no due order to apply to.`);
      }
      setPaymentRoute(null);
      await loadData();
    } catch (error) {
      toast.error("Payment failed", error instanceof Error ? error.message : "Could not record route payment.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRouteLock(row: RouteInvoiceRow) {
    if (!apiBase) return;
    setSaving(true);
    try {
      const nextLocked = !row.locked;
      await authFetch(`${apiBase}/orders/route-invoices/${row.routeId}/lock`, {
        method: "POST",
        body: JSON.stringify({ date, locked: nextLocked })
      });
      setRows((current) => current.map((item) => item.routeId === row.routeId ? { ...item, locked: nextLocked } : item));
      toast.success(nextLocked ? "Orders locked" : "Orders unlocked", `${row.routeName} vehicle edits are ${nextLocked ? "blocked" : "allowed"} for ${date}.`);
    } catch (error) {
      toast.error("Lock failed", error instanceof Error ? error.message : "Could not update order lock.");
    } finally {
      setSaving(false);
    }
  }

  async function openCustomers(row: RouteInvoiceRow) {
    if (!apiBase) return;
    setCustomerRoute(row);
    setModalLoading(true);
    try {
      const data = await authFetch<{ customers: Customer[] }>(`${apiBase}/customers?pageSize=500`);
      setCustomers(data.customers);
    } catch (error) {
      toast.error("Could not load customers", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setModalLoading(false);
    }
  }

  async function openProducts(row: RouteInvoiceRow) {
    if (!apiBase) return;
    setProductsRoute(row);
    setModalLoading(true);
    try {
      const data = await authFetch<{ routePrices: RoutePrice[] }>(`${apiBase}/catalog/route-prices?routeId=${encodeURIComponent(row.routeId)}`);
      setRoutePrices(data.routePrices);
    } catch (error) {
      toast.error("Could not load route products", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setModalLoading(false);
    }
  }

  function exportRouteInvoice(row: RouteInvoiceRow) {
    try {
      downloadPdf(`route-invoice-${safeFilePart(row.routeName)}-${date}.pdf`, routeInvoicePdf(row, date));
      toast.success("PDF downloaded", `${row.routeName} route invoice is ready.`);
    } catch (error) {
      toast.error("PDF failed", error instanceof Error ? error.message : "Could not generate route invoice PDF.");
    }
  }

  return (
    <AppShell title="Star Bakery" subtitle="Route invoices, dues, and payments" surface="bakery">
      <section className="rounded-lg border border-line bg-panel shadow-subtle">
        <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[minmax(220px,1fr)_180px_40px] md:items-end">
          <label className="grid gap-1 text-sm font-semibold">
            Search Route
            <input
              className="h-10 rounded-md border border-line bg-panel2 px-3 outline-none focus:border-mint"
              onChange={(event) => setRouteSearch(event.target.value)}
              placeholder="Search routes"
              value={routeSearch}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">Date<DateInput className="h-10 rounded-md border border-line bg-panel2 px-3 outline-none focus:border-mint" onChange={setDate} value={date} /></label>
          <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadData} title="Refresh" type="button"><RefreshCw size={16} /></button>
        </div>
        {loading ? <LoadingSpinner label="Loading route invoices" /> : null}
        <div className="grid gap-2 border-b border-line p-4 text-sm sm:grid-cols-2 lg:grid-cols-7">
          <span className="rounded-md bg-panel2 p-3">Routes<br /><strong>{totals?.routes || 0}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Customers<br /><strong>{totals?.customers || 0}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Previous Due Amount<br /><strong>{formatAmount(totals?.oldDue)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Order Amount<br /><strong>{formatAmount(totals?.orderAmount)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Total Amount<br /><strong>{formatAmount(totalAmount(Number(totals?.oldDue || 0), Number(totals?.orderAmount || 0)))}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Paid Amount<br /><strong>{formatAmount(totals?.paidAmount)}</strong></span>
          <span className="rounded-md bg-panel2 p-3">Today&apos;s Due Amount<br /><strong>{formatAmount(todaysDueAmount(Number(totals?.oldDue || 0), Number(totals?.orderAmount || 0), Number(totals?.paidAmount || 0)))}</strong></span>
        </div>
        <div className="w-full max-w-full overflow-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3 text-right">Customers</th>
                <th className="px-4 py-3 text-right">Previous Due Amount</th>
                <th className="px-4 py-3 text-right">Order Amount</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Paid Amount</th>
                <th className="px-4 py-3 text-right">Today&apos;s Due Amount</th>
                <th className="table-action-cell px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleRows.map((row) => {
                const fullAmount = totalAmount(row.oldDue, row.orderAmount);
                const todaysDue = todaysDueAmount(row.oldDue, row.orderAmount, row.paidAmount);
                return (
                <tr key={row.routeId}>
                  <td className="px-4 py-3 font-semibold">
                    <span className="block">{row.routeName}</span>
                    {row.locked ? <span className="mt-1 inline-flex rounded-md border border-berry/30 bg-berry/10 px-2 py-0.5 text-xs font-semibold text-berry">Locked</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right">{row.customerCount}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(row.oldDue)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(row.orderAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(fullAmount)}</td>
                  <td className="px-4 py-3 text-right">{formatAmount(row.paidAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(todaysDue)}</td>
                  <td className="table-action-cell px-4 py-3">
                    <div className="table-action-grid">
                      <button className="focus-ring inline-flex items-center gap-1 rounded-md bg-mint px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={!todaysDue || saving} onClick={() => openPayment(row)} type="button"><Eye size={14} /> Record Payment</button>
                      <button className={`focus-ring inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50 ${row.locked ? "border border-line bg-panel2" : "bg-berry text-white"}`} disabled={saving} onClick={() => toggleRouteLock(row)} type="button">
                        {row.locked ? <Unlock size={14} /> : <Lock size={14} />}
                        {row.locked ? "Unlock Orders" : "Lock Orders"}
                      </button>
                      <button className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold" onClick={() => exportRouteInvoice(row)} type="button"><Download size={14} /> PDF</button>
                      <button className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold" onClick={() => openCustomers(row)} type="button"><Users size={14} /> Customers</button>
                      <button className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-panel2 px-3 py-2 text-xs font-semibold" onClick={() => openProducts(row)} type="button"><PackageSearch size={14} /> Products</button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {!loading && !visibleRows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={8}>No routes found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={Boolean(paymentRoute)} title="Record route payment" description={paymentRoute ? `${paymentRoute.routeName} today's due amount ${formatAmount(todaysDueAmount(paymentRoute.oldDue, paymentRoute.orderAmount, paymentRoute.paidAmount))}` : ""} onClose={() => setPaymentRoute(null)}>
        {paymentRoute ? (
          <form className="grid gap-4" onSubmit={recordPayment}>
            <div className="grid gap-3 rounded-lg border border-line bg-panel2 p-4 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-muted">Previous Due Amount</p>
                <p className="mt-1 font-semibold">{formatAmount(paymentRoute.oldDue)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Order Amount</p>
                <p className="mt-1 font-semibold">{formatAmount(paymentRoute.orderAmount)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Paid Amount</p>
                <p className="mt-1 font-semibold">{formatAmount(paymentRoute.paidAmount)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted">Today&apos;s Due Amount</p>
                <p className="mt-1 font-semibold text-berry">{formatAmount(todaysDueAmount(paymentRoute.oldDue, paymentRoute.orderAmount, paymentRoute.paidAmount))}</p>
              </div>
            </div>
            <label className="grid gap-1 text-sm font-semibold">
              Payment type
              <select
                className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                onChange={(event) => {
                  const type = event.target.value;
                  setPaymentForm((current) => ({
                    ...current,
                    type,
                    amount: type === "PARTIAL" ? "" : String(paymentAmountForType(paymentRoute, type) || "")
                  }));
                }}
                value={paymentForm.type}
              >
                {paymentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">Amount<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" max={todaysDueAmount(paymentRoute.oldDue, paymentRoute.orderAmount, paymentRoute.paidAmount)} min="1" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} readOnly={paymentForm.type !== "PARTIAL"} required type="number" value={paymentForm.amount} /></label>
            <label className="grid gap-1 text-sm font-semibold">Payment method<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))} value={paymentForm.method}>{paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Reference<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} value={paymentForm.reference} /></label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setPaymentRoute(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Record Payment"}</button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(customerRoute)} title={customerRoute ? `${customerRoute.routeName} customers` : "Customers"} description={`${selectedRouteCustomers.length} customer${selectedRouteCustomers.length === 1 ? "" : "s"}`} onClose={() => setCustomerRoute(null)}>
        {modalLoading ? <LoadingSpinner label="Loading customers" /> : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">City</th><th className="px-3 py-2 text-right">Due</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {selectedRouteCustomers.map((customer) => (
                  <tr key={customer.id}><td className="px-3 py-2 font-semibold">{customer.name}</td><td className="px-3 py-2">{customer.phone || "-"}</td><td className="px-3 py-2">{customer.city || "-"}</td><td className="px-3 py-2 text-right">{formatAmount(customer.dueBalance)}</td></tr>
                ))}
                {!selectedRouteCustomers.length ? <tr><td className="px-3 py-6 text-center text-muted" colSpan={4}>No customers found for this route.</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(productsRoute)} title={productsRoute ? `${productsRoute.routeName} product prices` : "Product prices"} description={`${routePrices.length} product${routePrices.length === 1 ? "" : "s"} priced`} onClose={() => setProductsRoute(null)}>
        {modalLoading ? <LoadingSpinner label="Loading products" /> : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Base Price</th><th className="px-3 py-2 text-right">Route Price</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {routePrices.map((price) => (
                  <tr key={price.id}><td className="px-3 py-2 font-semibold">{price.product.name}</td><td className="px-3 py-2">{productCategory(price)}</td><td className="px-3 py-2 text-right">{formatAmount(price.product.unitPrice)}</td><td className="px-3 py-2 text-right font-semibold">{formatAmount(price.price)}</td></tr>
                ))}
                {!routePrices.length ? <tr><td className="px-3 py-6 text-center text-muted" colSpan={4}>No route product prices set.</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
