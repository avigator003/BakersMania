"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
};

type ToastInput = Omit<Toast, "id">;

const toastConfig = {
  success: { icon: CheckCircle2, className: "border-mint/20 bg-mint/10 text-mint" },
  error: { icon: XCircle, className: "border-berry/20 bg-berry/10 text-berry" },
  warning: { icon: AlertTriangle, className: "border-saffron/25 bg-saffron/10 text-saffron" },
  info: { icon: Info, className: "border-line bg-panel2 text-ink" }
};

const ToastContext = createContext<{
  toast: (input: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...input, id }]);
      window.setTimeout(() => removeToast(id), 4500);
    },
    [removeToast]
  );

  const value = useMemo(
    () => ({
      toast,
      success: (title: string, description?: string) => toast({ type: "success", title, description }),
      error: (title: string, description?: string) => toast({ type: "error", title, description }),
      warning: (title: string, description?: string) => toast({ type: "warning", title, description }),
      info: (title: string, description?: string) => toast({ type: "info", title, description })
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[70] grid w-[min(420px,calc(100vw-32px))] gap-3">
        {toasts.map((toast) => {
          const config = toastConfig[toast.type];
          const Icon = config.icon;
          return (
            <article key={toast.id} className={`rounded-lg border bg-panel p-4 shadow-subtle ${config.className}`}>
              <div className="flex items-start gap-3">
                <Icon size={20} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{toast.title}</h3>
                  {toast.description ? <p className="mt-1 text-sm leading-5 text-muted">{toast.description}</p> : null}
                </div>
                <button className="focus-ring grid h-7 w-7 place-items-center rounded-md" onClick={() => removeToast(toast.id)} title="Dismiss notification">
                  <X size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
