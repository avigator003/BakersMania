"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, IndianRupee, RefreshCw, UserRound } from "lucide-react";
import { AppShell } from "../../../../components/shell";
import { useToast } from "../../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../../lib/api";

type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "PAID_LEAVE" | "UNPAID_LEAVE";
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
    totalPaid: number;
    advancePaid: number;
    partialPaid: number;
    fullPaid: number;
  };
  attendance: Array<{
    id: string;
    workDate: string;
    status: AttendanceStatus;
    notes?: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    period: string;
    paymentType: PaymentType;
    reason?: string | null;
    method?: string | null;
    reference?: string | null;
    paidAt: string;
    notes?: string | null;
  }>;
  absentDates: string[];
  halfDayDates: string[];
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

function statusClass(status: AttendanceStatus) {
  if (status === "PRESENT") return "border-mint/30 bg-mint/10 text-mint";
  if (status === "ABSENT") return "border-berry/30 bg-berry/10 text-berry";
  if (status === "HALF_DAY") return "border-saffron/30 bg-saffron/10 text-saffron";
  return "border-slate-400/30 bg-slate-100 text-slate-600";
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
  const [loading, setLoading] = useState(true);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";

  async function loadDetail(nextMonth = month) {
    if (!tenantSlug) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch<LabourDetail>(`/t/${tenantSlug}/staff/labour/${params.labourId}?month=${nextMonth}`);
      setDetail(response);
    } catch (error) {
      toast.error("Could not load labour overview", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [params.labourId]);

  return (
    <AppShell title="Bakery CRM" subtitle="Labour monthly attendance and payment overview" surface="bakery">
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
              <CalendarDays className="text-mint" size={20} />
              <h2 className="font-semibold">Absence And Half-Day Dates</h2>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-panel2 p-3">
                <p className="text-sm font-semibold text-berry">Absent</p>
                <div className="mt-3 grid gap-2 text-sm">
                  {detail?.absentDates.length ? detail.absentDates.map((date) => <span key={date}>{formatDate(date)}</span>) : <span className="text-muted">No absent dates</span>}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-panel2 p-3">
                <p className="text-sm font-semibold text-saffron">Half day</p>
                <div className="mt-3 grid gap-2 text-sm">
                  {detail?.halfDayDates.length ? detail.halfDayDates.map((date) => <span key={date}>{formatDate(date)}</span>) : <span className="text-muted">No half days</span>}
                </div>
              </div>
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

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-panel shadow-subtle">
            <div className="border-b border-line p-4">
              <h2 className="font-semibold">Attendance Log</h2>
            </div>
            <div className="divide-y divide-line">
              {loading ? <p className="p-4 text-sm text-muted">Loading attendance...</p> : null}
              {detail?.attendance.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-semibold">{formatDate(item.workDate)}</p>
                    <p className="text-muted">{item.notes || "No notes"}</p>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status.replace("_", " ")}</span>
                </div>
              ))}
              {!loading && !detail?.attendance.length ? <p className="p-4 text-sm text-muted">No attendance marked for this month.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel shadow-subtle">
            <div className="border-b border-line p-4">
              <h2 className="font-semibold">Payment Log</h2>
            </div>
            <div className="divide-y divide-line">
              {loading ? <p className="p-4 text-sm text-muted">Loading payments...</p> : null}
              {detail?.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-semibold">{formatAmount(payment.amount)} · {payment.period}</p>
                    <p className="text-muted">{payment.reason || "No reason"} · {payment.method || "No method"} · {formatDate(payment.paidAt)}</p>
                    {payment.reference ? <p className="text-xs text-muted">Ref: {payment.reference}</p> : null}
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${paymentClass(payment.paymentType)}`}>{payment.paymentType}</span>
                </div>
              ))}
              {!loading && !detail?.payments.length ? <p className="p-4 text-sm text-muted">No payments recorded for this month.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
