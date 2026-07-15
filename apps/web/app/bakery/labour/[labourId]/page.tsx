"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IndianRupee, RefreshCw, UserRound } from "lucide-react";
import { AppShell } from "../../../../components/shell";
import { useToast } from "../../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../../lib/api";

type PaymentType = "ADVANCE" | "PARTIAL" | "FULL";

type LabourDetail = {
  month: string;
  labour: {
    id: string;
    name: string;
    phone?: string | null;
    role: string;
    skill?: string | null;
    dailyWage?: string | null;
    monthlySalary?: string | null;
    active: boolean;
    joinedAt: string;
    notes?: string | null;
  };
  stats: {
    presentDays: number;
    halfDays: number;
    absentDays: number;
    leaveDays: number;
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
    totalPaid: number;
    advancePaid: number;
    partialPaid: number;
    fullPaid: number;
  };
};

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

export default function LabourDetailPage() {
  const params = useParams<{ labourId: string }>();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [detail, setDetail] = useState<LabourDetail | null>(null);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";

  async function loadDetail(nextMonth = month) {
    if (!tenantSlug) {
      toast.error("Bakery slug missing", "Please sign in again.");
      return;
    }

    try {
      const response = await authFetch<LabourDetail>(`/t/${tenantSlug}/staff/labour/${params.labourId}?month=${nextMonth}`);
      setDetail(response);
    } catch (error) {
      toast.error("Could not load labour overview", error instanceof Error ? error.message : "Please check API and login.");
    }
  }

  useEffect(() => {
    loadDetail();
  }, [params.labourId]);

  return (
    <AppShell title="Bakery CRM" subtitle="Labour monthly salary overview" surface="bakery">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel p-5 shadow-subtle">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-mint text-white">
                <UserRound size={22} />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase text-mint">Labour Overview</p>
                <h1 className="mt-1 text-2xl font-bold">{detail?.labour.name || "Loading labour"}</h1>
                <p className="mt-1 text-sm text-muted">
                  {detail?.labour.skill || "General labour"} · {detail?.labour.phone || "No phone"} · Joined {formatDate(detail?.labour.joinedAt)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-muted">
                <span>Present: <span className="font-semibold text-ink">{detail?.stats.presentDays ?? 0}</span></span>
                <span>Half: <span className="font-semibold text-ink">{detail?.stats.halfDays ?? 0}</span></span>
                <span>Absent: <span className="font-semibold text-ink">{detail?.stats.absentDays ?? 0}</span></span>
                <span>Payable: <span className="font-semibold text-ink">{formatAmount(detail?.stats.payableAmount ?? 0)}</span></span>
                <span>Balance: <span className="font-semibold text-ink">{formatAmount(detail?.stats.balanceAmount ?? 0)}</span></span>
                <span>Paid: <span className="font-semibold text-ink">{formatAmount(detail?.stats.totalPaid ?? 0)}</span></span>
              </div>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Month</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => {
                    setMonth(event.target.value);
                    loadDetail(event.target.value);
                  }}
                  type="month"
                  value={month}
                />
              </label>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={() => loadDetail(month)} title="Refresh overview">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-panel shadow-subtle">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <IndianRupee className="text-mint" size={20} />
              <h2 className="font-semibold">Salary Calculation</h2>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {[
                ["Monthly Salary", formatAmount(detail?.labour.monthlySalary)],
                ["Daily Salary", formatAmount(detail?.stats.dailySalary ?? 0)],
                ["Payable Days", `${detail?.stats.payableDays ?? 0}/${detail?.stats.eligibleDays ?? 0}`],
                ["Payable Amount", formatAmount(detail?.stats.payableAmount ?? 0)],
                ["Opening Advance", formatAmount(detail?.stats.openingAdvanceAmount ?? 0)],
                ["Advance Applied", formatAmount(detail?.stats.advanceAppliedAmount ?? 0)],
                ["Paid Amount", formatAmount(detail?.stats.totalPaid ?? 0)],
                ["Carry Forward", formatAmount(detail?.stats.carryForwardAmount ?? 0)],
                ["Balance Amount", formatAmount(detail?.stats.balanceAmount ?? 0)]
              ].map(([label, value]) => (
                <div className="rounded-lg border border-line bg-panel2 p-3" key={label}>
                  <p className="text-xs font-semibold uppercase text-muted">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel shadow-subtle">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <IndianRupee className="text-mint" size={20} />
              <h2 className="font-semibold">Payment Breakdown</h2>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {([
                ["Advance", detail?.stats.advancePaid ?? 0, "ADVANCE" as PaymentType],
                ["Partial", detail?.stats.partialPaid ?? 0, "PARTIAL" as PaymentType],
                ["Full", detail?.stats.fullPaid ?? 0, "FULL" as PaymentType]
              ] as Array<[string, number, PaymentType]>).map(([label, value, type]) => (
                <div key={label} className={`rounded-lg border p-3 ${paymentClass(type)}`}>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-2 text-xl font-bold">{formatAmount(value)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
