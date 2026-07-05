"use client";

import { FormEvent, useEffect, useState } from "react";
import { MapPinned, Plus, RefreshCw, Truck } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { Modal } from "../../../components/modal";
import { PaginationControls, usePagination } from "../../../components/pagination";
import { PhotoPicker } from "../../../components/photo-picker";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Vehicle = {
  id: string;
  name: string;
  number?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  rcExpiryDate?: string | null;
  rcPhotoUrl?: string | null;
  pucExpiryDate?: string | null;
  pucPhotoUrl?: string | null;
  insuranceExpiryDate?: string | null;
  insurancePhotoUrl?: string | null;
  fitnessExpiryDate?: string | null;
  fitnessPhotoUrl?: string | null;
  active: boolean;
};

type Route = {
  id: string;
  name: string;
  active: boolean;
  vehicle?: Vehicle | null;
};

type Tab = "routes" | "vehicles";

const initialRouteForm = {
  name: "",
  vehicleId: "",
  active: true
};

const initialVehicleForm = {
  name: "",
  number: "",
  driverName: "",
  driverPhone: "",
  rcExpiryDate: "",
  rcPhotoUrl: "",
  pucExpiryDate: "",
  pucPhotoUrl: "",
  insuranceExpiryDate: "",
  insurancePhotoUrl: "",
  fitnessExpiryDate: "",
  fitnessPhotoUrl: "",
  active: true
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export default function BakeryRoutesPage() {
  const toast = useToast();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("routes");
  const [routeOpen, setRouteOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [routeForm, setRouteForm] = useState(initialRouteForm);
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";
  const routesPage = usePagination(routes, 25);
  const vehiclesPage = usePagination(vehicles, 25);

  async function loadData() {
    if (!apiBase) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [routeData, vehicleData] = await Promise.all([
        authFetch<{ routes: Route[] }>(`${apiBase}/routes`),
        authFetch<{ vehicles: Vehicle[] }>(`${apiBase}/routes/vehicles`)
      ]);
      setRoutes(routeData.routes);
      setVehicles(vehicleData.vehicles);
    } catch (error) {
      toast.error("Could not load routes", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/routes`, {
        method: "POST",
        body: JSON.stringify({ ...routeForm, vehicleId: routeForm.vehicleId || undefined })
      });
      toast.success("Route created", `${routeForm.name} is ready for assignment.`);
      setRouteForm(initialRouteForm);
      setRouteOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Route creation failed", error instanceof Error ? error.message : "Could not create route.");
    } finally {
      setSaving(false);
    }
  }

  async function createVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/routes/vehicles`, {
        method: "POST",
        body: JSON.stringify({
          ...vehicleForm,
          rcExpiryDate: vehicleForm.rcExpiryDate || undefined,
          pucExpiryDate: vehicleForm.pucExpiryDate || undefined,
          insuranceExpiryDate: vehicleForm.insuranceExpiryDate || undefined,
          fitnessExpiryDate: vehicleForm.fitnessExpiryDate || undefined
        })
      });
      toast.success("Vehicle onboarded", `${vehicleForm.name} is available for routes.`);
      setVehicleForm(initialVehicleForm);
      setVehicleOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Vehicle onboarding failed", error instanceof Error ? error.message : "Could not create vehicle.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Route and vehicle management" surface="bakery">
      <div className="grid gap-6">
        <section className="summary-grid">
          {[
            ["Routes", routes.length],
            ["Active routes", routes.filter((route) => route.active).length],
            ["Vehicles", vehicles.length],
            ["Active vehicles", vehicles.filter((vehicle) => vehicle.active).length]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-panel p-4 shadow-subtle">
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Route & Vehicle Management</h1>
              <p className="mt-1 text-sm text-muted">Create vehicles with document expiry details, then assign vehicles to delivery routes.</p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={() => setVehicleOpen(true)}>
                <Truck size={16} />
                Onboard Vehicle
              </button>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setRouteOpen(true)}>
                <Plus size={16} />
                Create Route
              </button>
              <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="flex gap-2 border-b border-line p-4">
            {[
              ["routes", "Routes"],
              ["vehicles", "Vehicles"]
            ].map(([value, label]) => (
              <button
                className={`focus-ring rounded-md px-4 py-2 text-sm font-semibold ${activeTab === value ? "bg-mint text-white" : "border border-line bg-panel2 text-muted"}`}
                key={value}
                onClick={() => setActiveTab(value as Tab)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? <p className="p-4 text-sm text-muted">Loading route data...</p> : null}

          {activeTab === "routes" ? (
            <>
            <div className="grid gap-3 p-3 sm:hidden">
              {routesPage.pageItems.map((route) => (
                <article key={route.id} className="rounded-lg border border-line bg-panel2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{route.name}</h3>
                      <p className="text-xs text-muted">{route.vehicle ? `${route.vehicle.name} · ${route.vehicle.number || "No number"}` : "No vehicle"}</p>
                    </div>
                    <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${route.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"}`}>
                      {route.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-3 rounded-md bg-panel px-3 py-2 text-xs text-muted">
                    Driver: {route.vehicle?.driverName ? `${route.vehicle.driverName} · ${route.vehicle.driverPhone || "No phone"}` : "-"}
                  </p>
                </article>
              ))}
              {!loading && !routes.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No routes found.</p> : null}
            </div>
            <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Driver</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {routesPage.pageItems.map((route) => (
                    <tr key={route.id}>
                      <td className="px-4 py-3 font-semibold">{route.name}</td>
                      <td className="px-4 py-3">
                        {route.vehicle ? `${route.vehicle.name} · ${route.vehicle.number || "No number"}` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {route.vehicle?.driverName ? `${route.vehicle.driverName} · ${route.vehicle.driverPhone || "No phone"}` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${route.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"}`}>
                          {route.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!loading && !routes.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-muted" colSpan={4}>No routes found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <PaginationControls {...routesPage} />
            </>
          ) : (
            <>
            <div className="grid gap-3 p-3 sm:hidden">
              {vehiclesPage.pageItems.map((vehicle) => (
                <article key={vehicle.id} className="rounded-lg border border-line bg-panel2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{vehicle.name}</h3>
                      <p className="text-xs text-muted">{vehicle.number || "No number"}</p>
                    </div>
                    <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${vehicle.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"}`}>
                      {vehicle.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="rounded-md bg-panel px-3 py-2">Driver: {vehicle.driverName || "-"}</span>
                    <span className="rounded-md bg-panel px-3 py-2">Phone: {vehicle.driverPhone || "-"}</span>
                    <span className="rounded-md bg-panel px-3 py-2">RC: {formatDate(vehicle.rcExpiryDate)}</span>
                    <span className="rounded-md bg-panel px-3 py-2">PUC: {formatDate(vehicle.pucExpiryDate)}</span>
                    <span className="rounded-md bg-panel px-3 py-2">Insurance: {formatDate(vehicle.insuranceExpiryDate)}</span>
                    <span className="rounded-md bg-panel px-3 py-2">Fitness: {formatDate(vehicle.fitnessExpiryDate)}</span>
                  </div>
                </article>
              ))}
              {!loading && !vehicles.length ? <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No vehicles found.</p> : null}
            </div>
            <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Driver</th>
                    <th className="px-4 py-3">RC</th>
                    <th className="px-4 py-3">PUC</th>
                    <th className="px-4 py-3">Insurance</th>
                    <th className="px-4 py-3">Fitness</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {vehiclesPage.pageItems.map((vehicle) => (
                    <tr key={vehicle.id} className="align-top">
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{vehicle.name}</span>
                        <span className="text-xs text-muted">{vehicle.number || "No number"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block">{vehicle.driverName || "-"}</span>
                        <span className="text-xs text-muted">{vehicle.driverPhone || ""}</span>
                      </td>
                      <td className="px-4 py-3">{formatDate(vehicle.rcExpiryDate)}<br /><span className="text-xs text-mint">{vehicle.rcPhotoUrl || ""}</span></td>
                      <td className="px-4 py-3">{formatDate(vehicle.pucExpiryDate)}<br /><span className="text-xs text-mint">{vehicle.pucPhotoUrl || ""}</span></td>
                      <td className="px-4 py-3">{formatDate(vehicle.insuranceExpiryDate)}<br /><span className="text-xs text-mint">{vehicle.insurancePhotoUrl || ""}</span></td>
                      <td className="px-4 py-3">{formatDate(vehicle.fitnessExpiryDate)}<br /><span className="text-xs text-mint">{vehicle.fitnessPhotoUrl || ""}</span></td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${vehicle.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"}`}>
                          {vehicle.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!loading && !vehicles.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-muted" colSpan={7}>No vehicles found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <PaginationControls {...vehiclesPage} />
            </>
          )}
        </section>

        <Modal open={routeOpen} title="Create Route" description="Assign an onboarded vehicle to this route if needed." onClose={() => setRouteOpen(false)}>
          <form className="grid gap-3" onSubmit={createRoute}>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Route name</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setRouteForm((current) => ({ ...current, name: event.target.value }))} value={routeForm.name} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Vehicle</span>
              <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setRouteForm((current) => ({ ...current, vehicleId: event.target.value }))} value={routeForm.vehicleId}>
                <option value="">No vehicle</option>
                {vehicles.filter((vehicle) => vehicle.active).map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.number || "No number"}</option>
                ))}
              </select>
            </label>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setRouteOpen(false)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Create Route"}</button>
            </div>
          </form>
        </Modal>

        <Modal open={vehicleOpen} title="Onboard Vehicle" description="Selected document files are stored as filenames until cloud upload is wired." onClose={() => setVehicleOpen(false)}>
          <form className="grid gap-3" onSubmit={createVehicle}>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["name", "Vehicle name"],
                ["number", "Vehicle number"],
                ["driverName", "Driver name"],
                ["driverPhone", "Driver phone number"]
              ].map(([key, label]) => (
                <label key={key} className="grid gap-1">
                  <span className="text-sm font-medium">{label}</span>
                  <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setVehicleForm((current) => ({ ...current, [key]: event.target.value }))} value={String(vehicleForm[key as keyof typeof vehicleForm])} />
                </label>
              ))}
            </div>
            {[
              ["rc", "RC"],
              ["puc", "PUC"],
              ["insurance", "Insurance"],
              ["fitness", "Fitness"]
            ].map(([key, label]) => {
              const expiryKey = `${key}ExpiryDate` as keyof typeof vehicleForm;
              const photoKey = `${key}PhotoUrl` as keyof typeof vehicleForm;
              return (
                <div key={key} className="grid gap-3 rounded-md border border-line bg-panel2 p-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium">{label} expiry date</span>
                    <input className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint" onChange={(event) => setVehicleForm((current) => ({ ...current, [expiryKey]: event.target.value }))} type="date" value={String(vehicleForm[expiryKey])} />
                  </label>
                  <PhotoPicker
                    label={`${label} photo`}
                    onChange={(fileName) => setVehicleForm((current) => ({ ...current, [photoKey]: fileName }))}
                    value={String(vehicleForm[photoKey])}
                  />
                </div>
              );
            })}
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setVehicleOpen(false)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Onboard Vehicle"}</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
