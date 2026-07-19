"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { KeyRound, Save } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Vehicle = {
  id: string;
  name: string;
  number: string;
  driverName?: string | null;
  driverPhone?: string | null;
  routes?: { name: string }[];
};

export default function BakeryPasswordsPage() {
  const toast = useToast();
  const pathname = usePathname();
  const [password, setPassword] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [vehiclePassword, setVehiclePassword] = useState("");
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const pathSegments = pathname.split("/").filter(Boolean);
  const pathTenantSlug = pathSegments.length > 1 && pathSegments[1] === "bakery" ? pathSegments[0] : "";
  const tenantSlug = pathTenantSlug || (typeof window === "undefined" ? "" : getStoredTenantSlug() || "");
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const vehicleOptions = useMemo(() => vehicles.map((vehicle) => ({
    value: vehicle.id,
    label: `${vehicle.name} (${vehicle.number})`,
    description: [vehicle.driverName, vehicle.driverPhone, vehicle.routes?.map((route) => route.name).join(", ")].filter(Boolean).join(" - ") || undefined
  })), [vehicles]);

  async function loadVehicles() {
    if (!apiBase) return;
    setLoadingVehicles(true);
    try {
      const data = await authFetch<{ vehicles: Vehicle[] }>(`${apiBase}/routes/vehicles?pageSize=200`);
      setVehicles(data.vehicles);
      if (!data.vehicles.some((vehicle) => vehicle.id === vehicleId)) setVehicleId("");
    } catch (error) {
      toast.error("Could not load vehicles", error instanceof Error ? error.message : "Please sign in again.");
    } finally {
      setLoadingVehicles(false);
    }
  }

  useEffect(() => {
    loadVehicles();
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

  async function saveVehiclePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!apiBase || !vehicleId) {
      toast.warning("Select vehicle", "Choose a vehicle first.");
      return;
    }
    if (vehiclePassword.length < 6) {
      toast.warning("Password too short", "Use at least 6 characters.");
      return;
    }
    setSavingVehicle(true);
    try {
      await authFetch(`${apiBase}/routes/vehicles/${vehicleId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: vehiclePassword })
      });
      setVehiclePassword("");
      toast.success("Vehicle password changed", "The vehicle can use the new password next time.");
    } catch (error) {
      toast.error("Password change failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSavingVehicle(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Manage passwords" surface="bakery">
      <div className="grid max-w-3xl gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-panel p-4 shadow-subtle">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-mint/10 text-mint"><KeyRound size={20} /></span>
          <div>
            <h1 className="text-lg font-semibold">Bakery Password</h1>
            <p className="text-sm text-muted">Set a new login password for your bakery account.</p>
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
            <h1 className="text-lg font-semibold">Vehicle Password</h1>
            <p className="text-sm text-muted">Change password for any vehicle account.</p>
          </div>
        </div>
        <form className="grid gap-4" onSubmit={saveVehiclePassword}>
          <SearchableSelect
            disabled={loadingVehicles}
            label="Vehicle"
            onChange={setVehicleId}
            options={vehicleOptions}
            placeholder={loadingVehicles ? "Loading vehicles" : "Select vehicle"}
            searchPlaceholder="Search vehicles"
            value={vehicleId}
          />
          <label className="grid gap-1 text-sm font-semibold">
            New password
            <input
              className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
              minLength={6}
              onChange={(event) => setVehiclePassword(event.target.value)}
              required
              type="password"
              value={vehiclePassword}
            />
          </label>
          <button className="focus-ring inline-flex h-10 w-fit items-center gap-2 rounded-md bg-mint px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={savingVehicle || !vehicleId} type="submit">
            <Save size={16} />
            {savingVehicle ? "Saving..." : "Save vehicle password"}
          </button>
        </form>
      </section>
      </div>
    </AppShell>
  );
}
