"use client";

import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

export default function CustomerPasswordPage() {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      toast.warning("Password too short", "Use at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      await authFetch(`${apiBase}/customers/me/password`, {
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

  return (
    <AppShell title="Customer Portal" subtitle="Manage your login password" surface="customer">
      <section className="max-w-xl rounded-lg border border-line bg-panel p-4 shadow-subtle">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-mint/10 text-mint"><KeyRound size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold">Password</h1>
            <p className="text-sm text-muted">Set a new login password for your customer account.</p>
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
    </AppShell>
  );
}
