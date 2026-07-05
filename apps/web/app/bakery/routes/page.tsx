"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, MapPinned, Pencil, Plus, RefreshCw, Truck } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaginationControls } from "../../../components/pagination";
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

type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

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

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export default function BakeryRoutesPage() {
  const toast = useToast();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("routes");
  const [routeOpen, setRouteOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [viewRoute, setViewRoute] = useState<Route | null>(null);
  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [viewVehicle, setViewVehicle] = useState<Vehicle | null>(null);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [routeForm, setRouteForm] = useState(initialRouteForm);
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routesPage, setRoutesPage] = useState(1);
  const [routesPageSize, setRoutesPageSize] = useState(25);
  const [routesPageCount, setRoutesPageCount] = useState(1);
  const [routesTotal, setRoutesTotal] = useState(0);
  const [vehiclesPage, setVehiclesPage] = useState(1);
  const [vehiclesPageSize, setVehiclesPageSize] = useState(25);
  const [vehiclesPageCount, setVehiclesPageCount] = useState(1);
  const [vehiclesTotal, setVehiclesTotal] = useState(0);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadData() {
    if (!apiBase) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const routeParams = new URLSearchParams();
      routeParams.set("page", String(routesPage));
      routeParams.set("pageSize", String(routesPageSize));
      const vehicleParams = new URLSearchParams();
      vehicleParams.set("page", String(vehiclesPage));
      vehicleParams.set("pageSize", String(vehiclesPageSize));
      const [routeData, vehicleData] = await Promise.all([
        authFetch<{ routes: Route[]; pagination?: PaginationMeta }>(`${apiBase}/routes?${routeParams.toString()}`),
        authFetch<{ vehicles: Vehicle[]; pagination?: PaginationMeta }>(`${apiBase}/routes/vehicles?${vehicleParams.toString()}`)
      ]);
      setRoutes(routeData.routes);
      setRoutesTotal(routeData.pagination?.total ?? routeData.routes.length);
      setRoutesPageCount(routeData.pagination?.pageCount ?? 1);
      setRoutesPage(routeData.pagination?.page ?? routesPage);
      setRoutesPageSize(routeData.pagination?.pageSize ?? routesPageSize);
      setVehicles(vehicleData.vehicles);
      setVehiclesTotal(vehicleData.pagination?.total ?? vehicleData.vehicles.length);
      setVehiclesPageCount(vehicleData.pagination?.pageCount ?? 1);
      setVehiclesPage(vehicleData.pagination?.page ?? vehiclesPage);
      setVehiclesPageSize(vehicleData.pagination?.pageSize ?? vehiclesPageSize);
    } catch (error) {
      toast.error("Could not load routes", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [routesPage, routesPageSize, vehiclesPage, vehiclesPageSize]);

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

  function openEditRoute(route: Route) {
    setEditRoute(route);
    setRouteForm({
      name: route.name,
      vehicleId: route.vehicle?.id || "",
      active: route.active
    });
  }

  function openEditVehicle(vehicle: Vehicle) {
    setEditVehicle(vehicle);
    setVehicleForm({
      name: vehicle.name || "",
      number: vehicle.number || "",
      driverName: vehicle.driverName || "",
      driverPhone: vehicle.driverPhone || "",
      rcExpiryDate: dateInput(vehicle.rcExpiryDate),
      rcPhotoUrl: vehicle.rcPhotoUrl || "",
      pucExpiryDate: dateInput(vehicle.pucExpiryDate),
      pucPhotoUrl: vehicle.pucPhotoUrl || "",
      insuranceExpiryDate: dateInput(vehicle.insuranceExpiryDate),
      insurancePhotoUrl: vehicle.insurancePhotoUrl || "",
      fitnessExpiryDate: dateInput(vehicle.fitnessExpiryDate),
      fitnessPhotoUrl: vehicle.fitnessPhotoUrl || "",
      active: vehicle.active
    });
  }

  async function updateRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !editRoute) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/routes/${editRoute.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...routeForm, vehicleId: routeForm.vehicleId || undefined })
      });
      toast.success("Route updated", `${routeForm.name} was saved.`);
      setEditRoute(null);
      setRouteForm(initialRouteForm);
      await loadData();
    } catch (error) {
      toast.error("Route update failed", error instanceof Error ? error.message : "Could not update route.");
    } finally {
      setSaving(false);
    }
  }

  async function updateVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !editVehicle) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/routes/vehicles/${editVehicle.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...vehicleForm,
          rcExpiryDate: vehicleForm.rcExpiryDate || undefined,
          pucExpiryDate: vehicleForm.pucExpiryDate || undefined,
          insuranceExpiryDate: vehicleForm.insuranceExpiryDate || undefined,
          fitnessExpiryDate: vehicleForm.fitnessExpiryDate || undefined
        })
      });
      toast.success("Vehicle updated", `${vehicleForm.name} was saved.`);
      setEditVehicle(null);
      setVehicleForm(initialVehicleForm);
      await loadData();
    } catch (error) {
      toast.error("Vehicle update failed", error instanceof Error ? error.message : "Could not update vehicle.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Route and vehicle management" surface="bakery">
      <div className="grid gap-4">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-end">
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

          <div className="flex gap-2 border-b border-line p-3">
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

          {loading ? <LoadingSpinner label="Loading route data" /> : null}

          {activeTab === "routes" ? (
            <>
            <PaginationControls
              page={routesPage}
              pageCount={routesPageCount}
              pageSize={routesPageSize}
              setPage={setRoutesPage}
              setPageSize={setRoutesPageSize}
              total={routesTotal}
              summary={[
                { label: "Active routes", value: routes.filter((route) => route.active).length },
                { label: "Vehicles", value: vehiclesTotal },
                { label: "Active vehicles", value: vehicles.filter((vehicle) => vehicle.active).length }
              ]}
            />
            <div className="grid gap-3 p-3 sm:hidden">
              {routes.map((route) => (
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
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => setViewRoute(route)} title="View route" type="button"><Eye size={15} /></button>
                    <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openEditRoute(route)} title="Edit route" type="button"><Pencil size={15} /></button>
                  </div>
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
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {routes.map((route) => (
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
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => setViewRoute(route)} title="View route" type="button"><Eye size={15} /></button>
                          <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => openEditRoute(route)} title="Edit route" type="button"><Pencil size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && !routes.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-muted" colSpan={5}>No routes found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <>
            <PaginationControls
              page={vehiclesPage}
              pageCount={vehiclesPageCount}
              pageSize={vehiclesPageSize}
              setPage={setVehiclesPage}
              setPageSize={setVehiclesPageSize}
              total={vehiclesTotal}
              summary={[
                { label: "Routes", value: routesTotal },
                { label: "Active routes", value: routes.filter((route) => route.active).length },
                { label: "Active vehicles", value: vehicles.filter((vehicle) => vehicle.active).length }
              ]}
            />
            <div className="grid gap-3 p-3 sm:hidden">
              {vehicles.map((vehicle) => (
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
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => setViewVehicle(vehicle)} title="View vehicle" type="button"><Eye size={15} /></button>
                    <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openEditVehicle(vehicle)} title="Edit vehicle" type="button"><Pencil size={15} /></button>
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
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {vehicles.map((vehicle) => (
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
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => setViewVehicle(vehicle)} title="View vehicle" type="button"><Eye size={15} /></button>
                          <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => openEditVehicle(vehicle)} title="Edit vehicle" type="button"><Pencil size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && !vehicles.length ? (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-muted" colSpan={8}>No vehicles found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
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

        <Modal open={Boolean(viewRoute)} title="Route Details" description={viewRoute?.name || ""} onClose={() => setViewRoute(null)}>
          {viewRoute ? (
            <div className="divide-y divide-line text-sm">
              <p className="flex justify-between gap-3 py-3"><span className="text-muted">Route</span><span className="font-semibold">{viewRoute.name}</span></p>
              <p className="flex justify-between gap-3 py-3"><span className="text-muted">Status</span><span className="font-semibold">{viewRoute.active ? "Active" : "Inactive"}</span></p>
              <p className="flex justify-between gap-3 py-3"><span className="text-muted">Vehicle</span><span className="font-semibold">{viewRoute.vehicle ? `${viewRoute.vehicle.name} · ${viewRoute.vehicle.number || "No number"}` : "-"}</span></p>
              <p className="flex justify-between gap-3 py-3"><span className="text-muted">Driver</span><span className="font-semibold">{viewRoute.vehicle?.driverName || "-"}</span></p>
              <p className="flex justify-between gap-3 py-3"><span className="text-muted">Driver phone</span><span className="font-semibold">{viewRoute.vehicle?.driverPhone || "-"}</span></p>
            </div>
          ) : null}
        </Modal>

        <Modal open={Boolean(editRoute)} title="Edit Route" description={editRoute ? `Update ${editRoute.name}.` : ""} onClose={() => { setEditRoute(null); setRouteForm(initialRouteForm); }}>
          <form className="grid gap-3" onSubmit={updateRoute}>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Route name</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setRouteForm((current) => ({ ...current, name: event.target.value }))} value={routeForm.name} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Vehicle</span>
              <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setRouteForm((current) => ({ ...current, vehicleId: event.target.value }))} value={routeForm.vehicleId}>
                <option value="">No vehicle</option>
                {vehicles.filter((vehicle) => vehicle.active || vehicle.id === routeForm.vehicleId).map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.number || "No number"}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input checked={routeForm.active} onChange={(event) => setRouteForm((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              Active route
            </label>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => { setEditRoute(null); setRouteForm(initialRouteForm); }} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Route"}</button>
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

        <Modal open={Boolean(viewVehicle)} title="Vehicle Details" description={viewVehicle?.name || ""} onClose={() => setViewVehicle(null)}>
          {viewVehicle ? (
            <div className="divide-y divide-line text-sm">
              {[
                ["Vehicle", viewVehicle.name],
                ["Number", viewVehicle.number || "-"],
                ["Driver", viewVehicle.driverName || "-"],
                ["Driver phone", viewVehicle.driverPhone || "-"],
                ["Status", viewVehicle.active ? "Active" : "Inactive"],
                ["RC", `${formatDate(viewVehicle.rcExpiryDate)}${viewVehicle.rcPhotoUrl ? ` · ${viewVehicle.rcPhotoUrl}` : ""}`],
                ["PUC", `${formatDate(viewVehicle.pucExpiryDate)}${viewVehicle.pucPhotoUrl ? ` · ${viewVehicle.pucPhotoUrl}` : ""}`],
                ["Insurance", `${formatDate(viewVehicle.insuranceExpiryDate)}${viewVehicle.insurancePhotoUrl ? ` · ${viewVehicle.insurancePhotoUrl}` : ""}`],
                ["Fitness", `${formatDate(viewVehicle.fitnessExpiryDate)}${viewVehicle.fitnessPhotoUrl ? ` · ${viewVehicle.fitnessPhotoUrl}` : ""}`]
              ].map(([label, value]) => (
                <p className="flex justify-between gap-3 py-3" key={label}><span className="text-muted">{label}</span><span className="text-right font-semibold">{value}</span></p>
              ))}
            </div>
          ) : null}
        </Modal>

        <Modal open={Boolean(editVehicle)} title="Edit Vehicle" description={editVehicle ? `Update ${editVehicle.name}.` : ""} onClose={() => { setEditVehicle(null); setVehicleForm(initialVehicleForm); }}>
          <form className="grid gap-3" onSubmit={updateVehicle}>
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
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input checked={vehicleForm.active} onChange={(event) => setVehicleForm((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              Active vehicle
            </label>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => { setEditVehicle(null); setVehicleForm(initialVehicleForm); }} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Vehicle"}</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
