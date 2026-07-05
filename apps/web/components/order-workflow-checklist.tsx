"use client";

import { CheckCircle2, Circle, CreditCard, PackageCheck, Truck } from "lucide-react";

type WorkflowOrder = {
  status: string;
  paymentStatus: string;
  payments?: unknown[];
};

type Props = {
  order: WorkflowOrder;
  dueAmount: number;
  saving?: boolean;
  allowTruckLoading?: boolean;
  onTruckLoading?: () => void;
  onDelivered?: () => void;
  onNotDelivered?: () => void;
  onPayment?: () => void;
};

function isTruckLoaded(order: WorkflowOrder) {
  return ["DISPATCHED", "COMPLETED"].includes(order.status);
}

function isDelivered(order: WorkflowOrder) {
  return order.status === "COMPLETED";
}

function isPaymentDone(order: WorkflowOrder) {
  return order.paymentStatus === "PAID";
}

function StepIcon({ done }: { done: boolean }) {
  return done ? <CheckCircle2 className="text-mint" size={18} /> : <Circle className="text-muted" size={18} />;
}

function stepClass(done: boolean) {
  return done ? "border-mint/30 bg-mint/10" : "border-line bg-panel";
}

export function OrderWorkflowChecklist({
  order,
  dueAmount,
  saving,
  allowTruckLoading,
  onTruckLoading,
  onDelivered,
  onNotDelivered,
  onPayment
}: Props) {
  const truckLoaded = isTruckLoaded(order);
  const delivered = isDelivered(order);
  const paymentDone = isPaymentDone(order);

  return (
    <div className="mt-4 rounded-lg border border-line bg-panel p-3">
      <div className="grid gap-2 lg:grid-cols-3">
        <div className={`rounded-md border p-3 ${stepClass(truckLoaded)}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Truck size={18} />
              Truck loading
            </span>
            <StepIcon done={truckLoaded} />
          </div>
          <p className="mt-1 text-xs font-semibold text-muted">{truckLoaded ? "Done" : "Pending"}</p>
          {allowTruckLoading ? (
            <button
              className="focus-ring mt-3 w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={saving || truckLoaded}
              onClick={onTruckLoading}
              type="button"
            >
              Mark done
            </button>
          ) : null}
        </div>

        <div className={`rounded-md border p-3 ${stepClass(delivered)}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <PackageCheck size={18} />
              Delivery
            </span>
            <StepIcon done={delivered} />
          </div>
          <p className="mt-1 text-xs font-semibold text-muted">{delivered ? "Done" : "Pending"}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              className="focus-ring rounded-md border border-mint/30 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint disabled:opacity-50"
              disabled={saving || delivered}
              onClick={onDelivered}
              type="button"
            >
              Delivered
            </button>
            {onNotDelivered ? (
              <button
                className="focus-ring rounded-md border border-berry/30 bg-berry/10 px-3 py-2 text-sm font-semibold text-berry disabled:opacity-50"
                disabled={saving || !truckLoaded || delivered}
                onClick={onNotDelivered}
                type="button"
              >
                Not delivered
              </button>
            ) : null}
          </div>
        </div>

        <div className={`rounded-md border p-3 ${stepClass(paymentDone)}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <CreditCard size={18} />
              Payment
            </span>
            <StepIcon done={paymentDone} />
          </div>
          <p className="mt-1 text-xs font-semibold text-muted">{paymentDone ? "Done" : order.paymentStatus}</p>
          <button
            className="focus-ring mt-3 w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={saving || !dueAmount}
            onClick={onPayment}
            type="button"
          >
            {paymentDone ? "Payment done" : "Record payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
