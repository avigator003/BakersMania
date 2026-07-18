"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, Save } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Vehicle = {
  id: string;
  name: string;
  number?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
};

function randomPassword() {
  return `BM${Math.floor(100000 + Math.random() * 900000)}`;
}

export default function BakeryPasswordsPage() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [lastPassword, setLastPassword] = useState<{ name: string; password: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const vehicleOptions = useMemo(() => vehicles.map((vehicle) => ({
    value: vehicle.id,
    label: vehicle.name,
    description: [vehicle.number, vehicle.driverName, vehicle.driverPhone].filter(Boolean).join(" · ") || undefined
  })), [vehicles]);

  async function loadVehicles() {
    setLoading(true);
    try {
      const data = await authFetch<{ vehicles: Vehicle[] }>(`${apiBase}/routes/vehicles?pageSize=500`);
      setVehicles(data.vehicles);
      setVehicleId((current) => current || data.vehicles[0]?.id || "");
    } catch (error) {
      toast.error("Could not load vehicles", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (apiBase) void loadVehicles();
  }, [apiBase]);

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!vehicleId) {
      toast.warning("Select vehicle", "Choose a vehicle first.");
      return;
    }
    if (password.length < 6) {
      toast.warning("Password too short", "Use at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      const data = await authFetch<{ result: { vehicleName: string; password: string } }>(`${apiBase}/routes/vehicles/${vehicleId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password })
      });
      setLastPassword({ name: data.result.vehicleName, password: data.result.password });
      setPassword(randomPassword());
      toast.success("Vehicle password changed", `${data.result.vehicleName} can log in with the new password.`);
    } catch (error) {
      toast.error("Password reset failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Vehicle password help" surface="bakery">
      <section className="grid max-w-2xl gap-4 rounded-lg border border-line bg-panel p-4 shadow-subtle">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-mint/10 text-mint"><KeyRound size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold">Vehicle Passwords</h1>
            <p className="text-sm text-muted">Set a new password for a vehicle login account.</p>
          </div>
        </div>
        {loading ? <LoadingSpinner label="Loading vehicles" /> : null}
        <form className="grid gap-4" onSubmit={resetPassword}>
          <SearchableSelect onChange={setVehicleId} options={vehicleOptions} placeholder="Select vehicle" searchPlaceholder="Search vehicles" value={vehicleId} />
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
