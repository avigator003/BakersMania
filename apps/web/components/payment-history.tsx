"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Modal } from "./modal";

type PaymentHistoryPayment = {
  id: string;
  amount: string | number;
  method?: string | null;
  reference?: string | null;
  paidAt?: string | null;
};

type PaymentHistoryProps = {
  payments?: PaymentHistoryPayment[];
  total: string | number;
  compact?: boolean;
  iconOnly?: boolean;
};

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export function paymentTotal(payments?: PaymentHistoryPayment[]) {
  return (payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

export function paymentDue(total: string | number, payments?: PaymentHistoryPayment[]) {
  return Math.max(Number(total || 0) - paymentTotal(payments), 0);
}

export function resolvedPaymentStatus(total: string | number, payments?: PaymentHistoryPayment[], fallback = "UNPAID") {
  const paid = paymentTotal(payments);
  const grandTotal = Number(total || 0);
  if (paid >= grandTotal && grandTotal > 0) return "PAID";
  if (paid > 0) return "PARTIAL";
  return fallback;
}

export function PaymentHistory({ payments = [], total, compact = false, iconOnly = false }: PaymentHistoryProps) {
  const [open, setOpen] = useState(false);
  const paid = paymentTotal(payments);
  const due = paymentDue(total, payments);
  const buttonLabel = `Show payments (${payments.length})`;

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
        <button
          aria-label={iconOnly ? buttonLabel : undefined}
          className={
            iconOnly
              ? `focus-ring grid ${compact ? "h-8 w-full" : "h-10 w-10"} place-items-center rounded-md border border-line bg-panel2 text-ink hover:border-mint`
              : "focus-ring inline-flex items-center justify-center rounded-md border border-line bg-panel2 px-3 py-1.5 text-xs font-semibold hover:border-mint"
          }
          onClick={() => setOpen(true)}
          title={iconOnly ? buttonLabel : undefined}
          type="button"
        >
          {iconOnly ? <History size={14} /> : buttonLabel}
        </button>
      </div>

      <Modal
        open={open}
        title="Payments"
        description={`Paid ${formatAmount(paid)} · Due ${formatAmount(due)} · ${payments.length} payment${payments.length === 1 ? "" : "s"}`}
        onClose={() => setOpen(false)}
      >
        <div className="max-h-[520px] overflow-auto rounded-lg border border-line sm:hidden">
          <div className="grid gap-3 p-3">
            {payments.map((payment, index) => (
              <article className="rounded-lg border border-line bg-panel2 p-3" key={payment.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">Payment #{index + 1}</h3>
                    <p className="mt-1 text-xs text-muted">{formatDate(payment.paidAt)} · {payment.method || "Cash"}</p>
                    <p className="mt-1 truncate text-xs text-muted">{payment.reference || "No reference"}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{formatAmount(payment.amount)}</span>
                </div>
              </article>
            ))}
            {!payments.length ? (
              <div className="rounded-lg border border-line bg-panel2 px-4 py-8 text-center text-sm text-muted">No payment recorded yet.</div>
            ) : null}
          </div>
        </div>
        <div className="hidden max-h-[520px] overflow-auto rounded-lg border border-line sm:block">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Paid at</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payments.map((payment, index) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3 font-semibold">#{index + 1}</td>
                  <td className="px-4 py-3">{formatDate(payment.paidAt)}</td>
                  <td className="px-4 py-3">{payment.method || "Cash"}</td>
                  <td className="px-4 py-3 text-muted">{payment.reference || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatAmount(payment.amount)}</td>
                </tr>
              ))}
              {!payments.length ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={5}>No payment recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
