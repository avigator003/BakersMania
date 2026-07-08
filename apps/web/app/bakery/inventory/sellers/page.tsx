"use client";

import { FormEvent, useEffect, useState } from "react";
import { CreditCard, Plus, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../../../../components/shell";
import { DateInput, localDateInput, localMonthInput } from "../../../../components/date-input";
import { LoadingSpinner } from "../../../../components/loading-spinner";
import { Modal } from "../../../../components/modal";
import { PaginationControls } from "../../../../components/pagination";
import { useToast } from "../../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../../lib/api";

type RawMaterial = {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitPrice?: string | number | null;
};

type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  _count?: { purchases: number };
};

type PurchasePayment = {
  id: string;
  amount: string | number;
  paymentType: string;
  method?: string | null;
  paidAt: string;
};

type Purchase = {
  id: string;
  supplierId: string;
  itemId?: string | null;
  amount: string | number;
  paidAmount: string | number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  notes?: string | null;
  purchasedAt: string;
  supplier: Supplier;
  item?: RawMaterial | null;
  payments: PurchasePayment[];
};

type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type PurchaseSummary = {
  amount: number;
  paid: number;
  due: number;
};

const initialMonth = localMonthInput();
const initialDate = localDateInput();

const initialSupplierForm = { name: "", phone: "", email: "", address: "" };
const initialPurchaseForm = {
  supplierId: "",
  itemId: "",
  quantity: "",
  unitPrice: "",
  paidAmount: "",
  paymentType: "ADVANCE",
  method: "Cash",
  reference: "",
  notes: "",
  purchasedAt: initialDate
};

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatNumber(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function statusClass(status: Purchase["paymentStatus"]) {
  if (status === "PAID") return "border-mint/30 bg-mint/10 text-mint";
  if (status === "PARTIAL") return "border-amber-400/40 bg-amber-100 text-amber-700";
  return "border-berry/30 bg-berry/10 text-berry";
}

export default function RawMaterialSellersPage() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(initialMonth);
  const [status, setStatus] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(initialSupplierForm);
  const [purchaseForm, setPurchaseForm] = useState(initialPurchaseForm);
  const [payPurchase, setPayPurchase] = useState<Purchase | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", paymentType: "PARTIAL", method: "Cash", reference: "", note: "", paidAt: initialDate });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<PurchaseSummary>({ amount: 0, paid: 0, due: 0 });

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("month", month);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (status !== "all") params.set("status", status);
      if (supplierFilter !== "all") params.set("supplierId", supplierFilter);
      if (search.trim()) params.set("search", search.trim());
      const [supplierData, materialData, purchaseData] = await Promise.all([
        authFetch<{ suppliers: Supplier[] }>(`${apiBase}/suppliers`),
        authFetch<{ items: RawMaterial[] }>(`${apiBase}/inventory/items?pageSize=100`),
        authFetch<{ purchases: Purchase[]; pagination?: PaginationMeta; summary?: PurchaseSummary }>(`${apiBase}/suppliers/purchases?${params.toString()}`)
      ]);
      setSuppliers(supplierData.suppliers);
      setMaterials(materialData.items);
      setPurchases(purchaseData.purchases);
      setTotal(purchaseData.pagination?.total ?? purchaseData.purchases.length);
      setPageCount(purchaseData.pagination?.pageCount ?? 1);
      setPage(purchaseData.pagination?.page ?? page);
      setPageSize(purchaseData.pagination?.pageSize ?? pageSize);
      setTotals(purchaseData.summary ?? { amount: 0, paid: 0, due: 0 });
    } catch (error) {
      toast.error("Could not load seller payments", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [month, status, supplierFilter, page, pageSize, search]);

  async function createSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/suppliers`, {
        method: "POST",
        body: JSON.stringify({
          name: supplierForm.name,
          phone: supplierForm.phone || undefined,
          email: supplierForm.email || undefined,
          address: supplierForm.address || undefined
        })
      });
      toast.success("Seller created", `${supplierForm.name} was added.`);
      setSupplierForm(initialSupplierForm);
      setSupplierOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Seller creation failed", error instanceof Error ? error.message : "Could not create seller.");
    } finally {
      setSaving(false);
    }
  }

  async function createPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/suppliers/purchases`, {
        method: "POST",
        body: JSON.stringify({
          supplierId: purchaseForm.supplierId,
          itemId: purchaseForm.itemId,
          quantity: Number(purchaseForm.quantity || 0),
          unitPrice: Number(purchaseForm.unitPrice || 0),
          paidAmount: Number(purchaseForm.paidAmount || 0),
          paymentType: purchaseForm.paidAmount ? purchaseForm.paymentType : undefined,
          method: purchaseForm.method || undefined,
          reference: purchaseForm.reference || undefined,
          notes: purchaseForm.notes || undefined,
          purchasedAt: purchaseForm.purchasedAt
        })
      });
      toast.success("Purchase recorded", "Raw material stock and seller payment status were updated.");
      setPurchaseForm(initialPurchaseForm);
      setPurchaseOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Purchase creation failed", error instanceof Error ? error.message : "Could not create purchase.");
    } finally {
      setSaving(false);
    }
  }

  function openPayment(purchase: Purchase) {
    const due = Math.max(Number(purchase.amount || 0) - Number(purchase.paidAmount || 0), 0);
    setPayPurchase(purchase);
    setPaymentForm({ amount: String(due), paymentType: due >= Number(purchase.amount || 0) ? "FULL" : "PARTIAL", method: "Cash", reference: "", note: "", paidAt: initialDate });
  }

  async function markPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !payPurchase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/suppliers/purchases/${payPurchase.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentForm.amount || 0),
          paymentType: paymentForm.paymentType,
          method: paymentForm.method || undefined,
          reference: paymentForm.reference || undefined,
          note: paymentForm.note || undefined,
          paidAt: paymentForm.paidAt
        })
      });
      toast.success("Payment marked", `${formatAmount(paymentForm.amount)} was recorded for ${payPurchase.supplier.name}.`);
      setPayPurchase(null);
      await loadData();
    } catch (error) {
      toast.error("Payment failed", error instanceof Error ? error.message : "Could not mark payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Raw material sellers, purchases, and payments" surface="bakery">
      <div className="grid gap-4">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-3 xl:flex-row xl:items-center xl:justify-end">
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={() => setSupplierOpen(true)} type="button">
                <Plus size={16} />
                Add Seller
              </button>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setPurchaseOpen(true)} type="button">
                <Plus size={16} />
                Record Purchase
              </button>
              <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh" type="button">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-line p-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
            <label className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Search size={16} className="text-muted" />
              <input className="w-full bg-transparent text-sm outline-none" onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search seller, material, note" value={search} />
            </label>
            <input className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => { setMonth(event.target.value); setPage(1); }} type="month" value={month} />
            <select className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => { setStatus(event.target.value); setPage(1); }} value={status}>
              <option value="all">All status</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
            </select>
            <select className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => { setSupplierFilter(event.target.value); setPage(1); }} value={supplierFilter}>
              <option value="all">All sellers</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>

          {loading ? <LoadingSpinner label="Loading seller purchases" /> : null}
          <PaginationControls
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize}
            total={total}
            summary={[
              { label: "Sellers", value: suppliers.length },
              { label: "Month total", value: formatAmount(totals.amount) },
              { label: "Due", value: formatAmount(totals.due) }
            ]}
          />

          <div className="grid gap-3 p-3 sm:hidden">
            {purchases.map((purchase) => {
              const due = Math.max(Number(purchase.amount || 0) - Number(purchase.paidAmount || 0), 0);
              return (
                <article key={purchase.id} className="rounded-lg border border-line bg-panel2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{purchase.supplier.name}</h3>
                      <p className="text-xs text-muted">{purchase.item?.name || "Material"} · {formatDate(purchase.purchasedAt)}</p>
                    </div>
                    <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(purchase.paymentStatus)}`}>
                      {purchase.paymentStatus}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <span>
                      <span className="block text-xs text-muted">Amount</span>
                      <span className="font-semibold">{formatAmount(purchase.amount)}</span>
                    </span>
                    <span>
                      <span className="block text-xs text-muted">Paid</span>
                      <span className="font-semibold">{formatAmount(purchase.paidAmount)}</span>
                    </span>
                    <span>
                      <span className="block text-xs text-muted">Due</span>
                      <span className="font-semibold">{formatAmount(due)}</span>
                    </span>
                  </div>
                  <p className="mt-3 rounded-md bg-panel px-3 py-2 text-xs text-muted">
                    Qty: {formatNumber(purchase.quantity)} {purchase.item?.unit || ""} · {purchase.supplier.phone || "No phone"}
                  </p>
                  <button className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-white" disabled={due <= 0} onClick={() => openPayment(purchase)} type="button">
                    <CreditCard size={15} />
                    Pay
                  </button>
                </article>
              );
            })}
            {!loading && !purchases.length ? (
              <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No purchases found for this filter.</p>
            ) : null}
          </div>

          <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Raw material</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {purchases.map((purchase) => {
                  const due = Math.max(Number(purchase.amount || 0) - Number(purchase.paidAmount || 0), 0);
                  return (
                    <tr key={purchase.id}>
                      <td className="px-4 py-3">{formatDate(purchase.purchasedAt)}</td>
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{purchase.supplier.name}</span>
                        <span className="text-xs text-muted">{purchase.supplier.phone || "No phone"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{purchase.item?.name || "Material"}</span>
                        <span className="text-xs text-muted">{purchase.item?.category || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatNumber(purchase.quantity)} {purchase.item?.unit || ""}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(purchase.amount)}</td>
                      <td className="px-4 py-3 text-right">{formatAmount(purchase.paidAmount)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatAmount(due)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(purchase.paymentStatus)}`}>
                          {purchase.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-3 py-2 text-sm font-semibold text-white" disabled={due <= 0} onClick={() => openPayment(purchase)} type="button">
                          <CreditCard size={15} />
                          Pay
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !purchases.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted" colSpan={9}>No purchases found for this filter.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={supplierOpen} title="Add raw material seller" description="Create a seller/supplier that can be attached to raw material purchases." onClose={() => setSupplierOpen(false)}>
        <form className="grid gap-4" onSubmit={createSupplier}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Name<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} required value={supplierForm.name} /></label>
            <label className="grid gap-1 text-sm font-semibold">Phone<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} value={supplierForm.phone} /></label>
            <label className="grid gap-1 text-sm font-semibold">Email<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} type="email" value={supplierForm.email} /></label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Address<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} value={supplierForm.address} /></label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setSupplierOpen(false)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Create Seller"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={purchaseOpen} title="Record raw material purchase" description="This adds stock to raw material inventory and creates seller payable history." onClose={() => setPurchaseOpen(false)}>
        <form className="grid gap-4" onSubmit={createPurchase}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Seller<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPurchaseForm((current) => ({ ...current, supplierId: event.target.value }))} required value={purchaseForm.supplierId}><option value="">Select seller</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Raw material<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => { const material = materials.find((item) => item.id === event.target.value); setPurchaseForm((current) => ({ ...current, itemId: event.target.value, unitPrice: material?.unitPrice ? String(material.unitPrice) : current.unitPrice })); }} required value={purchaseForm.itemId}><option value="">Select material</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name} ({material.unit})</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Quantity<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0.001" onChange={(event) => setPurchaseForm((current) => ({ ...current, quantity: event.target.value }))} required step="0.001" type="number" value={purchaseForm.quantity} /></label>
            <label className="grid gap-1 text-sm font-semibold">Price per unit<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0" onChange={(event) => setPurchaseForm((current) => ({ ...current, unitPrice: event.target.value }))} required step="0.01" type="number" value={purchaseForm.unitPrice} /></label>
            <label className="grid gap-1 text-sm font-semibold">Paid now<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0" onChange={(event) => setPurchaseForm((current) => ({ ...current, paidAmount: event.target.value }))} placeholder="0 for unpaid" step="0.01" type="number" value={purchaseForm.paidAmount} /></label>
            <label className="grid gap-1 text-sm font-semibold">Payment type<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPurchaseForm((current) => ({ ...current, paymentType: event.target.value }))} value={purchaseForm.paymentType}><option value="ADVANCE">Advance</option><option value="PARTIAL">Partial</option><option value="FULL">Full</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setPurchaseForm((current) => ({ ...current, purchasedAt: value }))} value={purchaseForm.purchasedAt} /></label>
            <label className="grid gap-1 text-sm font-semibold">Method<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPurchaseForm((current) => ({ ...current, method: event.target.value }))} value={purchaseForm.method} /></label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Notes<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPurchaseForm((current) => ({ ...current, notes: event.target.value }))} value={purchaseForm.notes} /></label>
          <div className="rounded-md border border-line bg-panel2 p-3 text-sm text-muted">Total: <span className="font-semibold text-ink">{formatAmount(Number(purchaseForm.quantity || 0) * Number(purchaseForm.unitPrice || 0))}</span></div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setPurchaseOpen(false)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Record Purchase"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(payPurchase)} title={payPurchase ? `Pay ${payPurchase.supplier.name}` : "Mark payment"} description="Record advance, partial, or full payment for this purchase." onClose={() => setPayPurchase(null)}>
        <form className="grid gap-4" onSubmit={markPayment}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">Amount<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0.01" onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} required step="0.01" type="number" value={paymentForm.amount} /></label>
            <label className="grid gap-1 text-sm font-semibold">Type<select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, paymentType: event.target.value }))} value={paymentForm.paymentType}><option value="ADVANCE">Advance</option><option value="PARTIAL">Partial</option><option value="FULL">Full</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Date<DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setPaymentForm((current) => ({ ...current, paidAt: value }))} value={paymentForm.paidAt} /></label>
            <label className="grid gap-1 text-sm font-semibold">Method<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))} value={paymentForm.method} /></label>
            <label className="grid gap-1 text-sm font-semibold">Reference<input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} value={paymentForm.reference} /></label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Note<textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))} value={paymentForm.note} /></label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setPayPurchase(null)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Mark Payment"}</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
