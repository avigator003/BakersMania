"use client";

import { FormEvent, useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Profile = {
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    state?: string | null;
    city?: string | null;
    route?: { name: string } | null;
    creditLimit?: string | number | null;
  };
  summary: {
    orderTotal: number;
    paidTotal: number;
    dueBalance: number;
    creditExceeded: boolean;
  };
};

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function CustomerProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", state: "", city: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadProfile() {
    if (!apiBase) return;
    setLoading(true);
    try {
      const data = await authFetch<{ profile: Profile }>(`${apiBase}/customers/me`);
      setProfile(data.profile);
      setForm({
        name: data.profile.customer.name || "",
        phone: data.profile.customer.phone || "",
        address: data.profile.customer.address || "",
        state: data.profile.customer.state || "",
        city: data.profile.customer.city || "",
        notes: ""
      });
    } catch (error) {
      toast.error("Could not load profile", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/customers/me`, { method: "PATCH", body: JSON.stringify(form) });
      toast.success("Profile saved", "Your contact and delivery details were updated.");
      await loadProfile();
    } catch (error) {
      toast.error("Profile save failed", error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Customer Portal" subtitle="Profile, contact details, and route" surface="customer">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form className="rounded-lg border border-line bg-panel shadow-subtle" onSubmit={saveProfile}>
          <div className="flex items-center justify-between gap-3 border-b border-line p-4">
            <div>
              <h1 className="text-xl font-semibold">Profile</h1>
              <p className="mt-1 text-sm text-muted">Contact and delivery information used by the bakery.</p>
            </div>
            <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadProfile} title="Refresh profile" type="button"><RefreshCw size={16} /></button>
          </div>
          {loading ? <p className="p-4 text-sm text-muted">Loading profile...</p> : null}
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {[
              ["name", "Name"],
              ["phone", "Phone"],
              ["state", "State"],
              ["city", "City"]
            ].map(([key, label]) => (
              <label className="grid gap-1 text-sm font-semibold" key={key}>
                {label}
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} value={form[key as keyof typeof form]} />
              </label>
            ))}
            <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
              Address
              <textarea className="min-h-24 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} value={form.address} />
            </label>
          </div>
          <div className="flex justify-end border-t border-line p-4">
            <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit"><Save size={16} /> {saving ? "Saving..." : "Save Profile"}</button>
          </div>
        </form>

        <aside className="rounded-lg border border-line bg-panel p-4 shadow-subtle">
          <h2 className="text-lg font-semibold">Account</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <p className="rounded-md bg-panel2 p-3"><span className="block text-muted">Email</span><strong>{profile?.customer.email || "-"}</strong></p>
            <p className="rounded-md bg-panel2 p-3"><span className="block text-muted">Route</span><strong>{profile?.customer.route?.name || "No route assigned"}</strong></p>
            <p className="rounded-md bg-panel2 p-3"><span className="block text-muted">Credit limit</span><strong>{profile?.customer.creditLimit ? formatAmount(profile.customer.creditLimit) : "-"}</strong></p>
            <p className={`rounded-md p-3 ${profile?.summary.creditExceeded ? "bg-berry/10 text-berry" : "bg-panel2"}`}><span className="block text-muted">Due balance</span><strong>{formatAmount(profile?.summary.dueBalance || 0)}</strong></p>
            <p className="rounded-md bg-panel2 p-3"><span className="block text-muted">Paid total</span><strong>{formatAmount(profile?.summary.paidTotal || 0)}</strong></p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
