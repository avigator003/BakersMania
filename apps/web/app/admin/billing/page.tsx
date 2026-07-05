"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { Modal } from "../../../components/modal";
import { StatusDropdown } from "../../../components/status-dropdown";
import { useToast } from "../../../components/toast-provider";
import { authFetch } from "../../../lib/api";

type BillingStatus = "PENDING" | "PAID" | "OVERDUE" | "WAIVED";
type TenantStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "SUSPENDED";

type BillingRow = {
  id: string;
  status: TenantStatus;
  billingStatus: BillingStatus;
  recurrence: string;
  recurrenceMonths: number;
  monthlyAmount: string;
  lastPaymentDate?: string | null;
  lastPaymentPeriodFrom?: string | null;
  lastPaymentPeriodTo?: string | null;
  nextDueDate?: string | null;
  lastPaymentAmount?: string | null;
  tenant: {
    id: string;
    name: string;
    slug: string;
    ownerEmail: string;
  };
};

const billingStatusOptions = [
  { value: "PENDING" as const, label: "Pending", className: "border-saffron/30 bg-saffron/10 text-saffron" },
  { value: "PAID" as const, label: "Paid", className: "border-mint/30 bg-mint/10 text-mint" },
  { value: "OVERDUE" as const, label: "Overdue", className: "border-berry/30 bg-berry/10 text-berry" },
  { value: "WAIVED" as const, label: "Waived", className: "border-slate-400/30 bg-slate-100 text-slate-600" }
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatAmount(value?: string | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthInputValue(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthEnd(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month, 0);
}

function monthAfter(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month, 1);
}

function inclusiveMonthCount(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return Math.max(1, (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1);
}

function formatPeriod(from?: string | null, to?: string | null) {
  if (!from || !to) return "-";
  const formatter = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });
  return `${formatter.format(new Date(from))} - ${formatter.format(new Date(to))}`;
}

export default function AdminBillingPage() {
  const toast = useToast();
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueMonth, setDueMonth] = useState("");
  const [billingStatus, setBillingStatus] = useState<"" | BillingStatus>("");
  const [paymentForm, setPaymentForm] = useState<{
    row: BillingRow;
    paymentDate: string;
    periodFrom: string;
    periodTo: string;
    amount: string;
  } | null>(null);

  const stats = useMemo(() => {
    const paid = billing.filter((row) => row.billingStatus === "PAID").length;
    const pending = billing.filter((row) => row.billingStatus === "PENDING").length;
    const overdue = billing.filter((row) => row.billingStatus === "OVERDUE").length;
    const waived = billing.filter((row) => row.billingStatus === "WAIVED").length;
    return [
      ["Paid", String(paid)],
      ["Pending", String(pending)],
      ["Overdue", String(overdue)],
      ["Waived", String(waived)]
    ];
  }, [billing]);

  async function loadBilling(filters = { dueMonth, billingStatus }) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dueMonth) {
        params.set("from", dateInputValue(monthStart(filters.dueMonth)));
        params.set("to", dateInputValue(monthEnd(filters.dueMonth)));
      }
      if (filters.billingStatus) params.set("billingStatus", filters.billingStatus);
      const data = await authFetch<{ billing: BillingRow[] }>(`/platform-admin/billing${params.size ? `?${params}` : ""}`);
      setBilling(data.billing);
    } catch (error) {
      toast.error("Could not load billing", error instanceof Error ? error.message : "Please check API and admin login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
  }, []);

  async function updateBillingStatus(row: BillingRow, nextStatus: BillingStatus) {
    if (row.billingStatus === nextStatus) return;
    if (nextStatus === "PAID") {
      openPaymentModal(row);
      return;
    }
    try {
      await authFetch(`/platform-admin/billing/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          billingStatus: nextStatus,
          status: nextStatus === "OVERDUE" ? "PAST_DUE" : row.status,
          lastPaymentDate: row.lastPaymentDate || null,
          lastPaymentAmount: row.lastPaymentAmount ? Number(row.lastPaymentAmount) : null
        })
      });
      toast.success("Billing status updated", `${row.tenant.name} is now ${nextStatus}.`);
      await loadBilling();
    } catch (error) {
      toast.error("Billing update failed", error instanceof Error ? error.message : "Could not update billing status.");
    }
  }

  function openPaymentModal(row: BillingRow) {
    const periodFrom = monthInputValue(row.nextDueDate || row.lastPaymentPeriodTo || undefined);
    const periodTo = periodFrom;
    setPaymentForm({
      row,
      paymentDate: dateInputValue(new Date()),
      periodFrom,
      periodTo,
      amount: String(Number(row.monthlyAmount || 0) * inclusiveMonthCount(periodFrom, periodTo))
    });
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentForm) return;

    const monthsCovered = inclusiveMonthCount(paymentForm.periodFrom, paymentForm.periodTo);
    const nextDueDate = monthAfter(paymentForm.periodTo).toISOString();

    try {
      await authFetch(`/platform-admin/billing/${paymentForm.row.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          billingStatus: "PAID",
          status: "ACTIVE",
          lastPaymentDate: new Date(paymentForm.paymentDate).toISOString(),
          lastPaymentPeriodFrom: monthStart(paymentForm.periodFrom).toISOString(),
          lastPaymentPeriodTo: monthEnd(paymentForm.periodTo).toISOString(),
          lastPaymentAmount: Number(paymentForm.amount || 0),
          nextDueDate
        })
      });
      toast.success(
        "Payment recorded",
        `${paymentForm.row.tenant.name} paid ${formatAmount(paymentForm.amount)} for ${formatPeriod(monthStart(paymentForm.periodFrom).toISOString(), monthEnd(paymentForm.periodTo).toISOString())}.`
      );
      setPaymentForm(null);
      await loadBilling();
    } catch (error) {
      toast.error("Payment record failed", error instanceof Error ? error.message : "Could not update billing.");
    }
  }

  return (
    <AppShell title="Platform Admin" subtitle="Billing, payment dates, recurrence, and subscription status" surface="admin">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-4 border-b border-line p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CreditCard className="text-mint" size={20} />
                  <h1 className="text-xl font-semibold">Billing</h1>
                </div>
                <p className="mt-1 text-sm text-muted">Track payment dates, recurrence, monthly amount, due date, and billing status.</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
                {stats.map(([label, value]) => (
                  <span key={label}>{label}: <span className="font-semibold text-ink">{value}</span></span>
                ))}
              </div>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={() => loadBilling({ dueMonth, billingStatus })}>
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Due month</span>
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none" onChange={(event) => setDueMonth(event.target.value)} type="month" value={dueMonth} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Billing status</span>
                <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none" onChange={(event) => setBillingStatus(event.target.value as "" | BillingStatus)} value={billingStatus}>
                  <option value="">All</option>
                  {billingStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 sm:flex sm:items-end">
                <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" onClick={() => loadBilling({ dueMonth, billingStatus })}>Apply</button>
                <button
                  className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold"
                  onClick={() => {
                    const emptyFilters = { dueMonth: "", billingStatus: "" as const };
                    setDueMonth("");
                    setBillingStatus("");
                    loadBilling(emptyFilters);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {loading ? <p className="p-4 text-sm text-muted">Loading billing...</p> : null}

          <div className="grid gap-3 p-3 sm:hidden">
            {billing.map((row) => (
              <article key={row.id} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{row.tenant.name}</h3>
                    <p className="truncate text-xs text-muted">{row.tenant.ownerEmail}</p>
                  </div>
                  <StatusDropdown
                    onChange={(status) => updateBillingStatus(row, status)}
                    options={billingStatusOptions}
                    title="Change billing status"
                    value={row.billingStatus}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-md bg-panel px-3 py-2">Monthly: {formatAmount(row.monthlyAmount)}</span>
                  <span className="rounded-md bg-panel px-3 py-2">Every {row.recurrenceMonths} month{row.recurrenceMonths > 1 ? "s" : ""}</span>
                  <span className="rounded-md bg-panel px-3 py-2">Last: {formatDate(row.lastPaymentDate)}</span>
                  <span className="rounded-md bg-panel px-3 py-2">Due: {formatDate(row.nextDueDate)}</span>
                </div>
                <p className="mt-3 rounded-md bg-panel px-3 py-2 text-xs text-muted">Covered: {formatPeriod(row.lastPaymentPeriodFrom, row.lastPaymentPeriodTo)} · Last amount {formatAmount(row.lastPaymentAmount)}</p>
                <button className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 py-2 font-semibold" onClick={() => openPaymentModal(row)}>
                  <CheckCircle2 size={16} />
                  Record Payment
                </button>
              </article>
            ))}
          </div>

          <div className="hidden w-full max-w-full overflow-x-auto sm:block">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Bakery</th>
                  <th className="px-4 py-3">Amount / month</th>
                  <th className="px-4 py-3">Recurrence</th>
                  <th className="px-4 py-3">Last payment</th>
                  <th className="px-4 py-3">Covered period</th>
                  <th className="px-4 py-3">Last amount</th>
                  <th className="px-4 py-3">Due date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {billing.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{row.tenant.name}</span>
                      <span className="text-xs text-muted">{row.tenant.ownerEmail}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatAmount(row.monthlyAmount)}</td>
                    <td className="px-4 py-3">{row.recurrenceMonths} month{row.recurrenceMonths > 1 ? "s" : ""}</td>
                    <td className="px-4 py-3">{formatDate(row.lastPaymentDate)}</td>
                    <td className="px-4 py-3">{formatPeriod(row.lastPaymentPeriodFrom, row.lastPaymentPeriodTo)}</td>
                    <td className="px-4 py-3">{formatAmount(row.lastPaymentAmount)}</td>
                    <td className="px-4 py-3">{formatDate(row.nextDueDate)}</td>
                    <td className="px-4 py-3">
                      <StatusDropdown
                        onChange={(status) => updateBillingStatus(row, status)}
                        options={billingStatusOptions}
                        title="Change billing status"
                        value={row.billingStatus}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 font-semibold" onClick={() => openPaymentModal(row)}>
                        <CheckCircle2 size={16} />
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Modal
          open={Boolean(paymentForm)}
          title="Record Payment"
          description={paymentForm ? `Mark payment received for ${paymentForm.row.tenant.name}.` : ""}
          onClose={() => setPaymentForm(null)}
        >
          {paymentForm ? (
            <form className="grid gap-3" onSubmit={recordPayment}>
              <div className="rounded-lg border border-line bg-panel2 p-3 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <p><span className="text-muted">Current due date:</span> <span className="font-semibold">{formatDate(paymentForm.row.nextDueDate)}</span></p>
                  <p><span className="text-muted">Amount/month:</span> <span className="font-semibold">{formatAmount(paymentForm.row.monthlyAmount)}</span></p>
                </div>
              </div>
              <label className="grid gap-1">
                <span className="text-sm font-medium">Payment date</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setPaymentForm((current) => (current ? { ...current, paymentDate: event.target.value } : current))}
                  type="date"
                  value={paymentForm.paymentDate}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">From month</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => {
                    const nextFrom = event.target.value;
                    setPaymentForm((current) =>
                      current
                        ? {
                            ...current,
                            periodFrom: nextFrom,
                            periodTo: current.periodTo < nextFrom ? nextFrom : current.periodTo,
                            amount: String(Number(current.row.monthlyAmount || 0) * inclusiveMonthCount(nextFrom, current.periodTo < nextFrom ? nextFrom : current.periodTo))
                          }
                        : current
                    );
                  }}
                  type="month"
                  value={paymentForm.periodFrom}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">To month</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  min={paymentForm.periodFrom}
                  onChange={(event) => {
                    const nextTo = event.target.value;
                    setPaymentForm((current) =>
                      current
                        ? {
                            ...current,
                            periodTo: nextTo,
                            amount: String(Number(current.row.monthlyAmount || 0) * inclusiveMonthCount(current.periodFrom, nextTo))
                          }
                        : current
                    );
                  }}
                  type="month"
                  value={paymentForm.periodTo}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">Payment amount</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  min={0}
                  onChange={(event) => setPaymentForm((current) => (current ? { ...current, amount: event.target.value } : current))}
                  type="number"
                  value={paymentForm.amount}
                />
              </label>
              <div className="rounded-lg border border-mint/25 bg-mint/10 p-3 text-sm text-mint">
                This covers {formatPeriod(monthStart(paymentForm.periodFrom).toISOString(), monthEnd(paymentForm.periodTo).toISOString())}. Next due date will move to {formatDate(monthAfter(paymentForm.periodTo).toISOString())}.
              </div>
              <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setPaymentForm(null)} type="button">
                  Cancel
                </button>
                <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" type="submit">
                  Save Payment
                </button>
              </div>
            </form>
          ) : null}
        </Modal>
      </div>
    </AppShell>
  );
}
