"use client";

import { useEffect, useMemo, useState } from "react";
import { IndianRupee, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../../../../components/shell";
import { LoadingSpinner } from "../../../../components/loading-spinner";
import { useToast } from "../../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../../lib/api";

type PaymentType = "ADVANCE" | "PARTIAL" | "FULL";

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
  active: boolean;
  salaryPayments: SalaryPayment[];
};

type LabourDashboard = {
  labours: Labour[];
};

type PaymentDraft = {
  amount: string;
  paymentType: PaymentType;
  reason: string;
  reference: string;
  notes: string;
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function monthInput() {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatAmount(value?: string | number | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
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

export default function LabourPaymentsPage() {
  const toast = useToast();
  const [labours, setLabours] = useState<Labour[]>([]);
  const [draft, setDraft] = useState<Record<string, PaymentDraft>>({});
  const [periodMonth, setPeriodMonth] = useState(monthInput());
  const [paidAt, setPaidAt] = useState(todayInput());
  const [method, setMethod] = useState("Cash");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiPath = tenantSlug ? `/t/${tenantSlug}/staff` : "";

  const activeLabours = useMemo(() => labours.filter((labour) => labour.active), [labours]);
  const visibleLabours = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeLabours;
    return activeLabours.filter((labour) =>
      [labour.name, labour.phone, labour.skill]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [activeLabours, search]);

  const draftRows = useMemo(() => {
    return activeLabours.filter((labour) => Number(draft[labour.id]?.amount || 0) > 0);
  }, [activeLabours, draft]);

  const totalAmount = useMemo(() => {
    return draftRows.reduce((total, labour) => total + Number(draft[labour.id]?.amount || 0), 0);
  }, [draftRows, draft]);

  async function loadPayments() {
    if (!apiPath) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch<LabourDashboard>(`${apiPath}/labour`);
      const active = response.labours.filter((labour) => labour.active);
      setLabours(response.labours);
      setDraft(Object.fromEntries(active.map((labour) => [labour.id, emptyDraft()])));
    } catch (error) {
      toast.error("Could not load payment sheet", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, []);

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
          return authFetch(`${apiPath}/salary-payments`, {
            method: "POST",
            body: JSON.stringify({
              labourId: labour.id,
              amount: Number(row.amount),
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
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setPaidAt(event.target.value)}
                  type="date"
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
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
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
              const latestPayment = labour.salaryPayments[0];
              return (
                <div key={labour.id} className="grid gap-3 p-4 xl:grid-cols-[1fr_180px_360px_1fr_180px] xl:items-center">
                  <div>
                    <p className="font-semibold">{labour.name}</p>
                    <p className="text-sm text-muted">{labour.skill || "General labour"} · {labour.phone || "No phone"}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatAmount(labour.dailyWage)} daily · {formatAmount(labour.monthlySalary)} monthly
                    </p>
                  </div>
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
                          onClick={() => updateDraft(labour.id, { paymentType: type as PaymentType })}
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
                    <span className="text-xs text-muted">
                      <IndianRupee className="mr-1 inline" size={12} />
                      Last: {latestPayment ? `${formatAmount(latestPayment.amount)} · ${latestPayment.period} · ${formatDate(latestPayment.paidAt)}` : "No payment yet"}
                    </span>
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
