"use client";

import { X } from "lucide-react";

export function Modal({
  open,
  title,
  description,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 px-4 py-6">
      <section className="flex max-h-[calc(100vh-3rem)] w-full max-w-[min(80vw,1200px)] flex-col rounded-lg border border-line bg-panel shadow-subtle">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line p-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
          </div>
          <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={onClose} title="Close modal">
            <X size={18} />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  variant = "default",
  loading,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} description={description} onClose={onClose}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={onClose} type="button">
          Cancel
        </button>
        <button
          className={`focus-ring rounded-md px-4 py-2 font-semibold text-white ${variant === "danger" ? "bg-berry" : "bg-mint"}`}
          disabled={loading}
          onClick={onConfirm}
          type="button"
        >
          {loading ? "Working..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
