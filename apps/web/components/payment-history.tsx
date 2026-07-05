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

export function PaymentHistory({ payments = [], total, compact = false }: PaymentHistoryProps) {
  const paid = paymentTotal(payments);
  const due = paymentDue(total, payments);

  return (
    <div className="rounded-md border border-line bg-panel p-3">
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <span>
          <span className="block text-xs text-muted">Paid</span>
          <strong>{formatAmount(paid)}</strong>
        </span>
        <span>
          <span className="block text-xs text-muted">Due</span>
          <strong className={due ? "text-berry" : "text-mint"}>{formatAmount(due)}</strong>
        </span>
        <span>
          <span className="block text-xs text-muted">Payments</span>
          <strong>{payments.length}</strong>
        </span>
      </div>

      {payments.length ? (
        <div className={`${compact ? "mt-2" : "mt-3"} grid gap-2`}>
          {payments.map((payment, index) => (
            <div className="rounded-md border border-line bg-panel2 px-3 py-2 text-xs" key={payment.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">#{index + 1} {formatAmount(payment.amount)}</span>
                <span className="text-muted">{formatDate(payment.paidAt)}</span>
              </div>
              <p className="mt-1 text-muted">
                {payment.method || "Cash"}{payment.reference ? ` · ${payment.reference}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">No payment recorded yet.</p>
      )}
    </div>
  );
}
