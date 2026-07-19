"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, PackageSearch, RefreshCw, Users } from "lucide-react";
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
  const fullAmount = totalAmount(row.oldDue, row.orderAmount);
  const due = todaysDueAmount(row.oldDue, row.orderAmount, row.paidAmount);
  const summaryRows = [
    ["Customers", String(row.customerCount)],
    ["Priced Products", String(row.pricedProductCount)],
    ["Previous Due Amount", formatPdfAmount(row.oldDue)],
    ["Order Amount", formatPdfAmount(row.orderAmount)],
    ["Total Amount", formatPdfAmount(fullAmount)],
    ["Paid Amount", formatPdfAmount(row.paidAmount)],
    ["Today's Due Amount", formatPdfAmount(due)]
  ];
  let content = "";
  content += pdfLine("Route Invoice", 48, 792, 18);
  content += pdfLine(`Route: ${row.routeName}`, 48, 765, 12);
  content += pdfLine(`Date: ${date}`, 48, 746, 10);
  let y = 700;
  summaryRows.forEach(([label, value]) => {
    const bottomY = y - 26;
    content += pdfBox(48, bottomY, 310, 26);
    content += pdfBox(358, bottomY, 188, 26, true);
    content += pdfLine(label, 60, bottomY + 9, 10);
    content += pdfLine(value, 370, bottomY + 9, 10);
    y -= 32;
  });
  return buildPdf(content);
}

function safeFilePart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "route";
}

export default function VehicleRouteInvoicesPage() {
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<RouteInvoiceRow[]>([]);
  const [totals, setTotals] = useState<RouteInvoiceResponse["routeInvoices"]["totals"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [customerRoute, setCustomerRoute] = useState<RouteInvoiceRow | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productsRoute, setProductsRoute] = useState<RouteInvoiceRow | null>(null);
  const [routePrices, setRoutePrices] = useState<RoutePrice[]>([]);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const selectedRouteCustomers = useMemo(
    () => customers.filter((customer) => customer.routeId === customerRoute?.routeId),
    [customerRoute?.routeId, customers]
  );

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
    downloadPdf(`vehicle-route-invoice-${safeFilePart(row.routeName)}-${date}.pdf`, routeInvoicePdf(row, date));
    toast.success("PDF downloaded", `${row.routeName} route invoice is ready.`);
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Route invoices for assigned routes" surface="vehicle">
      <section className="rounded-lg border border-line bg-panel shadow-subtle">
        <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[180px_40px] md:items-end md:justify-end">
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
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3 text-right">Customers</th>
                <th className="px-4 py-3 text-right">Previous Due Amount</th>
                <th className="px-4 py-3 text-right">Order Amount</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Paid Amount</th>
                <th className="px-4 py-3 text-right">Today&apos;s Due Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => {
                const fullAmount = totalAmount(row.oldDue, row.orderAmount);
                const todaysDue = todaysDueAmount(row.oldDue, row.orderAmount, row.paidAmount);
                return (
                  <tr key={row.routeId}>
                    <td className="px-4 py-3 font-semibold">{row.routeName}</td>
                    <td className="px-4 py-3 text-right">{row.customerCount}</td>
                    <td className="px-4 py-3 text-right">{formatAmount(row.oldDue)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAmount(row.orderAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAmount(fullAmount)}</td>
                    <td className="px-4 py-3 text-right">{formatAmount(row.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-berry">{formatAmount(todaysDue)}</td>
                    <td className="px-4 py-3">
                      <div className="table-action-grid table-action-grid--compact">
                        <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => exportRouteInvoice(row)} title="Download PDF" type="button"><Download size={15} /></button>
                        <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => openCustomers(row)} title="Customers" type="button"><Users size={15} /></button>
                        <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => openProducts(row)} title="Products" type="button"><PackageSearch size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !rows.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={8}>No assigned route invoices found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

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
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Route price</th><th className="px-3 py-2 text-right">Base price</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {routePrices.map((price) => (
                  <tr key={price.id}><td className="px-3 py-2 font-semibold">{price.product.name}</td><td className="px-3 py-2 text-muted">{productCategory(price)}</td><td className="px-3 py-2 text-right">{formatAmount(price.price)}</td><td className="px-3 py-2 text-right">{formatAmount(price.product.unitPrice)}</td></tr>
                ))}
                {!routePrices.length ? <tr><td className="px-3 py-6 text-center text-muted" colSpan={4}>No route prices found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
