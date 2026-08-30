"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../../../../components/shell";
import { DateInput, localDateInput, localMonthInput } from "../../../../components/date-input";
import { LoadingSpinner } from "../../../../components/loading-spinner";
import { useToast } from "../../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../../lib/api";

type PaymentType = "ADVANCE" | "PARTIAL" | "FULL";
type StatusFilter = "active" | "inactive" | "all";
type SummaryCardTone = "labour" | "payable" | "paid" | "balance" | "advance" | "rows" | "monthly" | "daily";

type SalaryPayment = {
  id: string;
  amount: string;
  period: string;
  paymentType: PaymentType;
  reason?: string | null;
  method?: string | null;
  paidAt: string;
};

type Labour = {
  id: string;
  name: string;
  phone?: string | null;
  skill?: string | null;
  dailyWage?: string | null;
  monthlySalary?: string | null;
  joinedAt: string;
  active: boolean;
  salaryPayments: SalaryPayment[];
  salaryCalculation?: {
    monthlySalary: number;
    daysInMonth: number;
    eligibleDays: number;
    payableDays: number;
    dailySalary: number;
    payableAmount: number;
    paidAmount: number;
    openingAdvanceAmount: number;
    advanceAppliedAmount: number;
    carryForwardAmount: number;
    balanceAmount: number;
  };
};

type LabourDashboard = {
  labours: Labour[];
  pagination?: {
    page: number;
    pageSize: number;
    pageCount: number;
  };
};

const labourPageSize = 100;

type PaymentDraft = {
  amount: string;
  paymentType: PaymentType;
  reason: string;
  reference: string;
  notes: string;
};

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatAmount(value?: string | number | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function paymentClass(type: PaymentType) {
  if (type === "ADVANCE") return "border-saffron/30 bg-saffron/10 text-saffron";
  if (type === "PARTIAL") return "border-berry/30 bg-berry/10 text-berry";
  return "border-mint/30 bg-mint/10 text-mint";
}

function emptyDraft(): PaymentDraft {
  return {
    amount: "",
    paymentType: "FULL",
    reason: "",
    reference: "",
    notes: ""
  };
}

function fullPaymentAmount(labour: Labour) {
  return Math.max(Number(labour.salaryCalculation?.balanceAmount || labour.salaryCalculation?.payableAmount || 0), 0);
}

function draftPaymentAmount(labour: Labour, row?: PaymentDraft) {
  if (row?.paymentType === "FULL") return fullPaymentAmount(labour);
  return Number(row?.amount || 0);
}

function SalaryMetric({ label, value, tone }: { label: string; value: string; tone: "payable" | "balance" | "days" | "advance" | "applied" | "carry" }) {
  const className = {
    payable: "border-mint/30 bg-mint/10 text-mint",
    balance: "border-berry/30 bg-berry/10 text-berry",
    days: "border-saffron/30 bg-saffron/10 text-saffron",
    advance: "border-slate-400/30 bg-slate-100 text-slate-700",
    applied: "border-sky-300 bg-sky-50 text-sky-700",
    carry: "border-indigo-300 bg-indigo-50 text-indigo-700"
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${className}`}>
      <span className="text-muted">{label}:</span>
      <span>{value}</span>
    </span>
  );
}

function summaryCardClass(tone: SummaryCardTone) {
  return {
    labour: "border-sky-300 bg-sky-50 text-sky-700",
    payable: "border-mint/30 bg-mint/10 text-mint",
    paid: "border-indigo-300 bg-indigo-50 text-indigo-700",
    balance: "border-berry/30 bg-berry/10 text-berry",
    advance: "border-slate-400/30 bg-slate-100 text-slate-700",
    rows: "border-saffron/30 bg-saffron/10 text-saffron",
    monthly: "border-emerald-300 bg-emerald-50 text-emerald-700",
    daily: "border-cyan-300 bg-cyan-50 text-cyan-700"
  }[tone];
}

export default function LabourPaymentsPage() {
  const toast = useToast();
  const [labours, setLabours] = useState<Labour[]>([]);
  const [draft, setDraft] = useState<Record<string, PaymentDraft>>({});
  const [periodMonth, setPeriodMonth] = useState(localMonthInput());
  const [paidAt, setPaidAt] = useState(localDateInput());
  const [method, setMethod] = useState("Cash");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiPath = tenantSlug ? `/t/${tenantSlug}/staff` : "";
  const labourDetailBasePath = tenantSlug ? `/${tenantSlug}/bakery/labour` : "/bakery/labour";

  const filteredLabours = useMemo(() => labours.filter((labour) => {
    if (statusFilter === "active") return labour.active;
    if (statusFilter === "inactive") return !labour.active;
    return true;
  }), [labours, statusFilter]);
  const visibleLabours = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return filteredLabours;
    return filteredLabours.filter((labour) =>
      [labour.name, labour.phone, labour.skill]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [filteredLabours, search]);

  const draftRows = useMemo(() => {
    return filteredLabours.filter((labour) => draftPaymentAmount(labour, draft[labour.id]) > 0);
  }, [filteredLabours, draft]);

  const totalAmount = useMemo(() => {
    return draftRows.reduce((total, labour) => total + draftPaymentAmount(labour, draft[labour.id]), 0);
  }, [draftRows, draft]);

  const paymentSummary = useMemo(() => {
    return filteredLabours.reduce(
      (summary, labour) => {
        const calculation = labour.salaryCalculation;
        summary.payable += Number(calculation?.payableAmount || 0);
        summary.paid += Number(calculation?.paidAmount || 0);
        summary.balance += Number(calculation?.balanceAmount || 0);
        summary.openingAdvance += Number(calculation?.openingAdvanceAmount || 0);
        summary.advanceApplied += Number(calculation?.advanceAppliedAmount || 0);
        summary.carryForward += Number(calculation?.carryForwardAmount || 0);
        summary.payableDays += Number(calculation?.payableDays || 0);
        summary.eligibleDays += Number(calculation?.eligibleDays || 0);
        if (Number(calculation?.balanceAmount || 0) > 0) summary.unpaidLabours += 1;
        return summary;
      },
      {
        payable: 0,
        paid: 0,
        balance: 0,
        openingAdvance: 0,
        advanceApplied: 0,
        carryForward: 0,
        payableDays: 0,
        eligibleDays: 0,
        unpaidLabours: 0
      }
    );
  }, [filteredLabours]);

  async function fetchLabourDashboard(date: string) {
    const buildPath = (page: number) => {
      const params = new URLSearchParams({
        date,
        status: statusFilter,
        page: String(page),
        pageSize: String(labourPageSize)
      });
      return `${apiPath}/labour?${params.toString()}`;
    };
    const firstPage = await authFetch<LabourDashboard>(buildPath(1));
    const pageCount = firstPage.pagination?.pageCount || 1;
    if (pageCount <= 1) return firstPage;
    const remainingPages = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) => authFetch<LabourDashboard>(buildPath(index + 2)))
    );
    return {
      ...firstPage,
      labours: [
        ...firstPage.labours,
        ...remainingPages.flatMap((page) => page.labours)
      ]
    };
  }

  async function loadPayments() {
    if (!apiPath) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetchLabourDashboard(`${periodMonth}-01`);
      setLabours(response.labours);
      setDraft(Object.fromEntries(response.labours.map((labour) => [labour.id, emptyDraft()])));
    } catch (error) {
      toast.error("Could not load payment sheet", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, [periodMonth, statusFilter]);

  function updateDraft(labourId: string, patch: Partial<PaymentDraft>) {
    setDraft((current) => ({
      ...current,
      [labourId]: {
        ...(current[labourId] || emptyDraft()),
        ...patch
      }
    }));
  }

  async function savePayments() {
    if (!apiPath) return;
    const rows = draftRows;
    if (!rows.length) {
      toast.warning("No payments entered", "Add an amount for at least one labourer before saving.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(
        rows.map((labour) => {
          const row = draft[labour.id] || emptyDraft();
          const amount = draftPaymentAmount(labour, row);
          return authFetch(`${apiPath}/salary-payments`, {
            method: "POST",
            body: JSON.stringify({
              labourId: labour.id,
              amount,
              paymentType: row.paymentType,
              period: monthLabel(periodMonth),
              reason: row.reason,
              method,
              reference: row.reference,
              paidAt,
              notes: row.notes
            })
          });
        })
      );
      toast.success("Payments saved", `${rows.length} payment record${rows.length === 1 ? "" : "s"} saved for ${monthLabel(periodMonth)}.`);
      await loadPayments();
    } catch (error) {
      toast.error("Payment save failed", error instanceof Error ? error.message : "Could not save payments.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Labour salary, advance, and partial payment sheet" surface="bakery">
      <div className="grid gap-4">
        <section className="rounded-lg border border-line bg-panel p-3 shadow-subtle">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-end">
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Labour status</span>
                <div className="inline-flex rounded-md border border-line bg-panel2 p-1 text-sm font-semibold">
                  {[
                    ["active", "Active"],
                    ["inactive", "Inactive"],
                    ["all", "All"]
                  ].map(([value, label]) => (
                    <button
                      className={`focus-ring rounded px-3 py-1.5 ${statusFilter === value ? "bg-mint text-white" : "text-muted hover:text-ink"}`}
                      key={value}
                      onClick={() => setStatusFilter(value as StatusFilter)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Salary month</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setPeriodMonth(event.target.value)}
                  type="month"
                  value={periodMonth}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Paid date</span>
                <DateInput
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={setPaidAt}
                  value={paidAt}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Method</span>
                <select
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setMethod(event.target.value)}
                  value={method}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </label>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadPayments} title="Refresh payments">
                <RefreshCw size={16} />
              </button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving || !draftRows.length} onClick={savePayments}>
                {saving ? "Saving..." : "Save Payments"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ["Labour", filteredLabours.length, `${paymentSummary.unpaidLabours} with balance`, "labour"],
            ["Total Payable", formatAmount(paymentSummary.payable), `${paymentSummary.payableDays}/${paymentSummary.eligibleDays} payable days`, "payable"],
            ["Paid This Month", formatAmount(paymentSummary.paid), `Selected: ${formatAmount(totalAmount)}`, "paid"],
            ["Balance Due", formatAmount(paymentSummary.balance), `Carry forward: ${formatAmount(paymentSummary.carryForward)}`, "balance"],
            ["Opening Advance", formatAmount(paymentSummary.openingAdvance), `Applied: ${formatAmount(paymentSummary.advanceApplied)}`, "advance"],
            ["Payment Rows", draftRows.length, `${method} · ${paidAt}`, "rows"],
            ["Monthly Salary Base", formatAmount(filteredLabours.reduce((sum, labour) => sum + Number(labour.monthlySalary || 0), 0)), monthLabel(periodMonth), "monthly"],
            ["Daily Wage Base", formatAmount(filteredLabours.reduce((sum, labour) => sum + Number(labour.dailyWage || 0), 0)), statusFilter === "all" ? "All labour" : `${statusFilter} labour`, "daily"]
          ] as Array<[string, string | number, string, SummaryCardTone]>).map(([label, value, helper, tone]) => (
            <div className={`rounded-lg border p-4 shadow-subtle ${summaryCardClass(tone)}`} key={label}>
              <p className="text-xs font-semibold uppercase opacity-80">{label}</p>
              <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
              <p className="mt-1 text-xs font-medium opacity-90">{helper}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex max-w-md items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Search size={16} className="text-muted" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search labour"
                value={search}
              />
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              <span>Rows: <span className="font-semibold text-ink">{draftRows.length}</span></span>
              <span>Total: <span className="font-semibold text-ink">{formatAmount(totalAmount)}</span></span>
              <span>Period: <span className="font-semibold text-ink">{monthLabel(periodMonth)}</span></span>
            </div>
          </div>

          {loading ? <LoadingSpinner label="Loading payment sheet" /> : null}

          <div className="divide-y divide-line">
            {visibleLabours.map((labour) => {
              const row = draft[labour.id] || emptyDraft();
              return (
                <div key={labour.id} className="grid gap-3 p-4 xl:grid-cols-[1fr_180px_360px_1fr_180px] xl:items-center">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{labour.name}</p>
                        <p className="text-sm text-muted">{labour.skill || "General labour"} · {labour.phone || "No phone"}</p>
                      </div>
                      <Link
                        aria-label={`View ${labour.name} details`}
                        className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-panel2 text-muted hover:border-mint hover:text-mint"
                        href={`${labourDetailBasePath}/${labour.id}`}
                        title="View details"
                      >
                        <Eye size={16} />
                      </Link>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatAmount(labour.dailyWage)} daily · {formatAmount(labour.monthlySalary)} monthly
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <SalaryMetric label="Payable" tone="payable" value={formatAmount(labour.salaryCalculation?.payableAmount)} />
                      <SalaryMetric label="Balance" tone="balance" value={formatAmount(labour.salaryCalculation?.balanceAmount)} />
                      <SalaryMetric label="Days" tone="days" value={`${labour.salaryCalculation?.payableDays ?? 0}/${labour.salaryCalculation?.eligibleDays ?? 0}`} />
                      <SalaryMetric label="Opening" tone="advance" value={formatAmount(labour.salaryCalculation?.openingAdvanceAmount)} />
                      <SalaryMetric label="Applied" tone="applied" value={formatAmount(labour.salaryCalculation?.advanceAppliedAmount)} />
                      <SalaryMetric label="Carry" tone="carry" value={formatAmount(labour.salaryCalculation?.carryForwardAmount)} />
                    </div>
                  </div>
                  {row.paymentType === "FULL" ? (
                    <div className="grid gap-1">
                      <span className="text-xs font-semibold text-muted">Full amount</span>
                      <div className="rounded-md border border-mint/30 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint">
                        {formatAmount(fullPaymentAmount(labour))}
                      </div>
                    </div>
                  ) : (
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-muted">Amount</span>
                      <input
                        className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-mint"
                        min="0"
                        onChange={(event) => updateDraft(labour.id, { amount: event.target.value })}
                        placeholder="0"
                        type="number"
                        value={row.amount}
                      />
                    </label>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["ADVANCE", "Advance"],
                      ["PARTIAL", "Partial"],
                      ["FULL", "Full"]
                    ].map(([type, label]) => {
                      const active = row.paymentType === type;
                      return (
                        <button
                          key={type}
                          className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${active ? paymentClass(type as PaymentType) : "border-line bg-panel2 text-muted"}`}
                          onClick={() => updateDraft(labour.id, {
                            paymentType: type as PaymentType,
                            ...(type === "FULL" ? { amount: "" } : {})
                          })}
                          type="button"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-mint"
                    onChange={(event) => updateDraft(labour.id, { reason: event.target.value })}
                    placeholder="Reason"
                    value={row.reason}
                  />
                  <div className="grid gap-2">
                    <input
                      className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-mint"
                      onChange={(event) => updateDraft(labour.id, { reference: event.target.value })}
                      placeholder="Reference"
                      value={row.reference}
                    />
                  </div>
                </div>
              );
            })}
            {!loading && !visibleLabours.length ? <p className="p-4 text-sm text-muted">No labour found.</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
