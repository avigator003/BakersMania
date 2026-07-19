"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { KeyRound, Save } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  route?: { name?: string | null } | null;
};

export default function VehiclePasswordsPage() {
  const toast = useToast();
  const pathname = usePathname();
  const [password, setPassword] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const pathSegments = pathname.split("/").filter(Boolean);
  const pathTenantSlug = pathSegments.length > 1 && pathSegments[1] === "vehicle" ? pathSegments[0] : "";
  const tenantSlug = pathTenantSlug || (typeof window === "undefined" ? "" : getStoredTenantSlug() || "");
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const customerOptions = useMemo(() => customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
    description: [customer.phone, customer.route?.name].filter(Boolean).join(" - ") || undefined
  })), [customers]);

  async function loadCustomers() {
    if (!apiBase) return;
    setLoadingCustomers(true);
    try {
      const data = await authFetch<{ customers: Customer[] }>(`${apiBase}/customers?pageSize=200&passwordScope=all`);
      setCustomers(data.customers);
      if (!data.customers.some((customer) => customer.id === customerId)) setCustomerId("");
    } catch (error) {
      toast.error("Could not load customers", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoadingCustomers(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, [apiBase]);

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      toast.warning("Password too short", "Use at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      await authFetch("/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({ password })
      });
      setPassword("");
      toast.success("Password changed", "Use the new password next time you log in.");
    } catch (error) {
      toast.error("Password change failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCustomerPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!apiBase || !customerId) {
      toast.warning("Select customer", "Choose a customer first.");
      return;
    }
    if (customerPassword.length < 6) {
      toast.warning("Password too short", "Use at least 6 characters.");
      return;
    }
    setSavingCustomer(true);
    try {
      await authFetch(`${apiBase}/customers/${customerId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: customerPassword })
      });
      setCustomerPassword("");
      toast.success("Customer password changed", "The customer can use the new password next time.");
    } catch (error) {
      toast.error("Password change failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSavingCustomer(false);
    }
  }

  return (
    <AppShell title="Vehicle Workspace" subtitle="Manage passwords" surface="vehicle">
      <div className="grid max-w-3xl gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-panel p-4 shadow-subtle">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-mint/10 text-mint"><KeyRound size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold">Vehicle Password</h1>
            <p className="text-sm text-muted">Set a new login password for your vehicle account.</p>
          </div>
        </div>
        <form className="grid gap-4" onSubmit={savePassword}>
          <label className="grid gap-1 text-sm font-semibold">
            New password
            <input
              className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button className="focus-ring inline-flex h-10 w-fit items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-white" disabled={saving} type="submit">
            <Save size={16} />
            {saving ? "Saving..." : "Save password"}
          </button>
        </form>
      </section>
      <section className="rounded-lg border border-line bg-panel p-4 shadow-subtle">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-mint/10 text-mint"><KeyRound size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold">Customer Password</h1>
            <p className="text-sm text-muted">Change password for any customer account.</p>
          </div>
        </div>
        <form className="grid gap-4" onSubmit={saveCustomerPassword}>
          <SearchableSelect
            disabled={loadingCustomers}
            label="Customer"
            onChange={setCustomerId}
            options={customerOptions}
            placeholder={loadingCustomers ? "Loading customers" : "Select customer"}
            searchPlaceholder="Search customers"
            value={customerId}
          />
          <label className="grid gap-1 text-sm font-semibold">
            New password
            <input
              className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
              minLength={6}
              onChange={(event) => setCustomerPassword(event.target.value)}
              required
              type="password"
              value={customerPassword}
            />
          </label>
          <button className="focus-ring inline-flex h-10 w-fit items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={savingCustomer || !customerId} type="submit">
            <Save size={16} />
            {savingCustomer ? "Saving..." : "Save customer password"}
          </button>
        </form>
      </section>
      </div>
    </AppShell>
  );
}
