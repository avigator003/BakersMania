"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, Save } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  route?: { name?: string | null } | null;
};

function randomPassword() {
  return `BM${Math.floor(100000 + Math.random() * 900000)}`;
}

export default function VehiclePasswordsPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [lastPassword, setLastPassword] = useState<{ name: string; password: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const customerOptions = useMemo(() => customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
    description: [customer.phone, customer.route?.name].filter(Boolean).join(" · ") || undefined
  })), [customers]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const data = await authFetch<{ customers: Customer[] }>(`${apiBase}/customers?pageSize=500`);
      setCustomers(data.customers);
      setCustomerId((current) => current || data.customers[0]?.id || "");
    } catch (error) {
      toast.error("Could not load customers", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (apiBase) void loadCustomers();
  }, [apiBase]);

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!customerId) {
      toast.warning("Select customer", "Choose a customer first.");
      return;
    }
    if (password.length < 6) {
      toast.warning("Password too short", "Use at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      const data = await authFetch<{ result: { customerName: string; password: string } }>(`${apiBase}/customers/${customerId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password })
      });
      setLastPassword({ name: data.result.customerName, password: data.result.password });
      setPassword(randomPassword());
      toast.success("Customer password changed", `${data.result.customerName} can log in with the new password.`);
    } catch (error) {
      toast.error("Password reset failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Customer password help" surface="vehicle">
      <section className="grid min-h-[calc(100vh-9rem)] max-w-2xl content-start gap-4 rounded-lg border border-line bg-panel p-4 shadow-subtle">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-mint/10 text-mint"><KeyRound size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold">Customer Passwords</h1>
            <p className="text-sm text-muted">Set a new password for customers assigned to this vehicle.</p>
          </div>
        </div>
        {loading ? <LoadingSpinner label="Loading customers" /> : null}
        <form className="grid gap-4" onSubmit={resetPassword}>
          <SearchableSelect onChange={setCustomerId} options={customerOptions} placeholder="Select customer" searchPlaceholder="Search customers" value={customerId} />
          <label className="grid gap-1 text-sm font-semibold">
            New password
            <div className="flex gap-2">
              <input className="min-w-0 flex-1 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" minLength={6} onChange={(event) => setPassword(event.target.value)} required type="text" value={password} />
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={() => setPassword(randomPassword())} title="Generate password" type="button"><RefreshCw size={16} /></button>
            </div>
          </label>
          <button className="focus-ring inline-flex h-10 w-fit items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-white" disabled={saving} type="submit">
            <Save size={16} />
            {saving ? "Saving..." : "Set password"}
          </button>
        </form>
        {lastPassword ? (
          <div className="rounded-md border border-line bg-panel2 p-3 text-sm">
            <p className="font-semibold">{lastPassword.name}</p>
            <p className="mt-1 text-muted">New password: <span className="font-semibold text-ink">{lastPassword.password}</span></p>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
