"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, Edit3, Eye, Trash2, UserPlus, Workflow } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { ConfirmModal, Modal } from "../../../components/modal";
import { StatusDropdown } from "../../../components/status-dropdown";
import { useToast } from "../../../components/toast-provider";
import { authFetch } from "../../../lib/api";
import { localDateInput } from "../../../components/date-input";

type TenantStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "SUSPENDED";
type BillingStatus = "PENDING" | "PAID" | "OVERDUE" | "WAIVED";
type OrderPipelineActor = "CUSTOMER" | "VEHICLE" | "BAKERY";

type OrderPipelineStage = {
  key: "CUSTOMER_SUBMITTED" | "VEHICLE_REVIEW" | "BAKERY_REVIEW";
  label: string;
  actorType: OrderPipelineActor;
  order: number;
  enabled: boolean;
};

type OrderPipelineForm = {
  enabled: boolean;
  stages: OrderPipelineStage[];
};

type TenantSubscription = {
  id: string;
  status: TenantStatus;
  billingStatus: BillingStatus;
  recurrence: string;
  recurrenceMonths: number;
  monthlyAmount: string;
  lastPaymentDate?: string | null;
  lastPaymentPeriodFrom?: string | null;
  lastPaymentPeriodTo?: string | null;
  nextDueDate?: string | null;
  lastPaymentAmount?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  currency: string;
  taxLabel: string;
  ownerEmail: string;
  phone?: string | null;
  address?: string | null;
  postgresConnectionId?: string | null;
  postgresConnection?: PostgresConnection | null;
  orderPipelineEnabled?: boolean;
  orderPipelineStages?: OrderPipelineStage[] | null;
  createdAt: string;
  updatedAt: string;
  subscriptions?: TenantSubscription[];
};

type PostgresConnection = {
  id: string;
  name: string;
  databaseUrl: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
  } | null;
};

type OnboardForm = {
  bakeryName: string;
  postgresConnectionId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  managerPassword: string;
  phone: string;
  address: string;
  monthlyAmount: string;
  recurrence: "MONTHLY" | "EVERY_2_MONTHS" | "QUARTERLY" | "YEARLY" | "CUSTOM";
  recurrenceMonths: string;
  lastPaymentDate: string;
  nextDueDate: string;
  lastPaymentAmount: string;
  billingStatus: "PENDING" | "PAID" | "OVERDUE" | "WAIVED";
};

type EditForm = {
  bakeryName: string;
  ownerEmail: string;
  phone: string;
  address: string;
  status: TenantStatus;
  postgresConnectionId: string;
};

const statusOptions: TenantStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "SUSPENDED"];
const actorLabels: Record<OrderPipelineActor, string> = {
  CUSTOMER: "Customer",
  VEHICLE: "Vehicle",
  BAKERY: "Bakery"
};
const defaultPipelineStages: OrderPipelineStage[] = [
  { key: "CUSTOMER_SUBMITTED", label: "Customer submitted", actorType: "CUSTOMER", order: 1, enabled: true },
  { key: "VEHICLE_REVIEW", label: "Vehicle review", actorType: "VEHICLE", order: 2, enabled: true },
  { key: "BAKERY_REVIEW", label: "Bakery review", actorType: "BAKERY", order: 3, enabled: true }
];
const statusDropdownOptions = [
  { value: "TRIALING" as const, label: "Trialing", className: "border-saffron/30 bg-saffron/10 text-saffron" },
  { value: "ACTIVE" as const, label: "Active", className: "border-mint/30 bg-mint/10 text-mint" },
  { value: "PAST_DUE" as const, label: "Past due", className: "border-berry/30 bg-berry/10 text-berry" },
  { value: "CANCELED" as const, label: "Canceled", className: "border-slate-400/30 bg-slate-100 text-slate-600" },
  { value: "SUSPENDED" as const, label: "Suspended", className: "border-berry/30 bg-berry/10 text-berry" }
];

const initialForm: OnboardForm = {
  bakeryName: "Demo Cakes",
  postgresConnectionId: "",
  ownerName: "Demo Owner",
  ownerEmail: "owner@democakes.local",
  ownerPassword: "Owner@123456",
  managerName: "Demo Manager",
  managerEmail: "manager@democakes.local",
  managerPhone: "+91 90000 00001",
  managerPassword: "Manager@123456",
  phone: "+91 90000 00000",
  address: "Demo bakery address",
  monthlyAmount: "1999",
  recurrence: "MONTHLY",
  recurrenceMonths: "1",
  lastPaymentDate: localDateInput(),
  nextDueDate: "",
  lastPaymentAmount: "1999",
  billingStatus: "PENDING"
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatAmount(value?: string | null, currency = "INR") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function formatPeriod(from?: string | null, to?: string | null) {
  if (!from || !to) return "-";
  const formatter = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });
  return `${formatter.format(new Date(from))} - ${formatter.format(new Date(to))}`;
}

function formatRecurrence(subscription?: TenantSubscription) {
  if (!subscription) return "-";
  return `${subscription.recurrenceMonths} month${subscription.recurrenceMonths > 1 ? "s" : ""}`;
}

function toEditForm(tenant: Tenant): EditForm {
  return {
    bakeryName: tenant.name,
    ownerEmail: tenant.ownerEmail,
    phone: tenant.phone || "",
    address: tenant.address || "",
    status: tenant.status,
    postgresConnectionId: tenant.postgresConnectionId || ""
  };
}

function pipelineStagesForTenant(tenant: Tenant) {
  return [...(tenant.orderPipelineStages?.length ? tenant.orderPipelineStages : defaultPipelineStages)].sort((a, b) => a.order - b.order);
}

function pipelineSummary(tenant: Tenant) {
  if (tenant.orderPipelineEnabled === false) return "Disabled";
  return pipelineStagesForTenant(tenant)
    .filter((stage) => stage.enabled)
    .map((stage) => actorLabels[stage.actorType])
    .join(" -> ") || "No stages";
}

function switchClass(active: boolean) {
  return active ? "bg-mint" : "bg-slate-300";
}

export default function AdminTenantsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [postgresConnections, setPostgresConnections] = useState<PostgresConnection[]>([]);
  const [form, setForm] = useState<OnboardForm>(initialForm);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [supportTenant, setSupportTenant] = useState<Tenant | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [pipelineTenant, setPipelineTenant] = useState<Tenant | null>(null);
  const [pipelineForm, setPipelineForm] = useState<OrderPipelineForm | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [deleteTenant, setDeleteTenant] = useState<Tenant | null>(null);
  const [statusAction, setStatusAction] = useState<{ tenant: Tenant; status: TenantStatus } | null>(null);

  const generatedSlug = slugify(form.bakeryName);
  const availablePostgresConnections = useMemo(
    () => postgresConnections.filter((connection) => !connection.tenant),
    [postgresConnections]
  );
  const editPostgresConnections = useMemo(
    () =>
      postgresConnections.filter(
        (connection) => !connection.tenant || connection.tenant.id === editTenant?.id
      ),
    [editTenant?.id, postgresConnections]
  );

  const stats = useMemo(() => {
    const active = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
    const trialing = tenants.filter((tenant) => tenant.status === "TRIALING").length;
    const suspended = tenants.filter((tenant) => tenant.status === "SUSPENDED").length;
    return [
      ["Bakeries", String(tenants.length)],
      ["Active", String(active)],
      ["Trialing", String(trialing)],
      ["Suspended", String(suspended)]
    ];
  }, [tenants]);

  async function loadTenants() {
    setLoading(true);
    try {
      const data = await authFetch<{ tenants: Tenant[] }>("/platform-admin/tenants");
      setTenants(data.tenants);
    } catch (error) {
      toast.error("Could not load bakeries", error instanceof Error ? error.message : "Login as platform admin and make sure the API is running.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPostgresConnections() {
    try {
      const data = await authFetch<{ connections: PostgresConnection[] }>("/platform-admin/postgres-connections");
      setPostgresConnections(data.connections);
    } catch (error) {
      toast.error("Could not load Postgres DBs", error instanceof Error ? error.message : "Create DB connections from the Postgres DBs page first.");
    }
  }

  useEffect(() => {
    loadTenants();
    loadPostgresConnections();
  }, []);

  async function onboardTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await authFetch("/platform-admin/tenants", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          slug: generatedSlug,
          monthlyAmount: Number(form.monthlyAmount || 0),
          recurrenceMonths: Number(form.recurrenceMonths || 1),
          lastPaymentDate: form.lastPaymentDate || undefined,
          nextDueDate: form.nextDueDate || undefined,
          lastPaymentAmount: form.lastPaymentAmount ? Number(form.lastPaymentAmount) : undefined,
          postgresConnectionId: form.postgresConnectionId || undefined
        })
      });
      toast.success("Bakery onboarded", `${form.bakeryName} was created successfully.`);
      setForm(initialForm);
      setCreateOpen(false);
      await loadTenants();
      await loadPostgresConnections();
    } catch (error) {
      toast.error("Onboarding failed", error instanceof Error ? error.message : "Generated slug may already exist or token may be missing.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTenant || !editForm) return;
    setSaving(true);
    try {
      await authFetch(`/platform-admin/tenants/${editTenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          postgresConnectionId: editForm.postgresConnectionId || null
        })
      });
      toast.success("Bakery updated", `${editForm.bakeryName} details were saved.`);
      setEditTenant(null);
      setEditForm(null);
      await loadTenants();
      await loadPostgresConnections();
    } catch (error) {
      toast.error("Update failed", error instanceof Error ? error.message : "Could not update bakery details.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTenantStatus(tenantId: string, status: TenantStatus) {
    const tenant = tenants.find((item) => item.id === tenantId);
    if (!tenant) return;
    setSaving(true);
    try {
      await authFetch(`/platform-admin/tenants/${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          bakeryName: tenant.name,
          ownerEmail: tenant.ownerEmail,
          phone: tenant.phone || "",
          address: tenant.address || "",
          status,
          postgresConnectionId: tenant.postgresConnectionId || null
        })
      });
      toast.success("Status updated", `${tenant.name} is now ${status}.`);
      setStatusAction(null);
      await loadTenants();
    } catch (error) {
      toast.error("Status update failed", error instanceof Error ? error.message : "Could not update bakery status.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTenant() {
    if (!deleteTenant) return;
    setSaving(true);
    try {
      await authFetch(`/platform-admin/tenants/${deleteTenant.id}`, { method: "DELETE" });
      toast.success("Bakery deleted", `${deleteTenant.name} was removed.`);
      setDeleteTenant(null);
      await loadTenants();
      await loadPostgresConnections();
    } catch (error) {
      toast.error("Delete failed", error instanceof Error ? error.message : "Could not delete bakery.");
    } finally {
      setSaving(false);
    }
  }

  async function openPipeline(tenant: Tenant) {
    setPipelineTenant(tenant);
    setPipelineForm(null);
    setPipelineLoading(true);
    try {
      const data = await authFetch<{ pipeline: OrderPipelineForm }>(`/platform-admin/tenants/${tenant.id}/order-pipeline`);
      setPipelineForm({
        enabled: data.pipeline.enabled,
        stages: [...data.pipeline.stages].sort((a, b) => a.order - b.order)
      });
    } catch (error) {
      toast.error("Could not load pipeline", error instanceof Error ? error.message : "Try again after refreshing the bakery list.");
      setPipelineTenant(null);
    } finally {
      setPipelineLoading(false);
    }
  }

  async function savePipeline() {
    if (!pipelineTenant || !pipelineForm) return;
    setSaving(true);
    try {
      await authFetch(`/platform-admin/tenants/${pipelineTenant.id}/order-pipeline`, {
        method: "PATCH",
        body: JSON.stringify(pipelineForm)
      });
      toast.success("Pipeline updated", `${pipelineTenant.name} order flow was saved.`);
      setPipelineTenant(null);
      setPipelineForm(null);
      await loadTenants();
    } catch (error) {
      toast.error("Pipeline update failed", error instanceof Error ? error.message : "Could not save this order flow.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(tenant: Tenant) {
    setEditTenant(tenant);
    setEditForm(toEditForm(tenant));
  }

  return (
    <AppShell title="Platform Admin" subtitle="Onboarding, support, billing status, and full tenant visibility" surface="admin">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Bakery Workspaces</h2>
              <p className="text-sm text-muted">Manage bakery details, status, activation, and deletion through modals.</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              {stats.map(([label, value]) => (
                <span key={label}>{label}: <span className="font-semibold text-ink">{value}</span></span>
              ))}
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setCreateOpen(true)}>
                <UserPlus size={18} />
                Onboard Bakery
              </button>
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={loadTenants}>
                Refresh
              </button>
            </div>
          </div>

          {loading ? <LoadingSpinner label="Loading tenants" /> : null}

          <div className="grid gap-3 p-3 sm:hidden">
            {tenants.map((tenant) => (
              <article key={tenant.id} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{tenant.name}</h3>
                    <p className="truncate text-xs text-muted">{tenant.ownerEmail}</p>
                  </div>
                  <StatusDropdown
                    onChange={(status) => {
                      if (status !== tenant.status) {
                        toast.warning("Confirm status change", `${tenant.name} will move from ${tenant.status} to ${status}.`);
                        setStatusAction({ tenant, status });
                      }
                    }}
                    options={statusDropdownOptions}
                    value={tenant.status}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-md bg-panel px-3 py-2">Slug: {tenant.slug}</span>
                  <span className="rounded-md bg-panel px-3 py-2">Phone: {tenant.phone || "-"}</span>
                  <span className="rounded-md bg-panel px-3 py-2">DB: {tenant.postgresConnection?.name || "Not attached"}</span>
                  <span className="rounded-md bg-panel px-3 py-2">Pipeline: {pipelineSummary(tenant)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-semibold"
                    onClick={() => {
                      toast.info("Opening bakery details", tenant.name);
                      setSupportTenant(tenant);
                    }}
                    title="View details"
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-semibold" onClick={() => openEdit(tenant)} title="Edit bakery">
                    <Edit3 size={16} />
                    Edit
                  </button>
                  <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-semibold" onClick={() => openPipeline(tenant)} title="Order pipeline">
                    <Workflow size={16} />
                    Pipeline
                  </button>
                  <button
                    className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-semibold text-berry"
                    onClick={() => {
                      toast.warning("Delete confirmation required", `${tenant.name} will not be deleted until you confirm.`);
                      setDeleteTenant(tenant);
                    }}
                    title="Delete bakery"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden w-full max-w-full overflow-x-auto sm:block">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Bakery</th>
                  <th className="px-4 py-3 font-semibold">Slug</th>
                  <th className="px-4 py-3 font-semibold">Owner Email</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Postgres DB</th>
                  <th className="px-4 py-3 font-semibold">Pipeline</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="align-middle">
                    <td className="px-4 py-3 font-semibold">{tenant.name}</td>
                    <td className="px-4 py-3 text-muted">{tenant.slug}</td>
                    <td className="px-4 py-3">{tenant.ownerEmail}</td>
                    <td className="px-4 py-3">
                      <StatusDropdown
                        onChange={(status) => {
                          if (status !== tenant.status) {
                            toast.warning("Confirm status change", `${tenant.name} will move from ${tenant.status} to ${status}.`);
                            setStatusAction({ tenant, status });
                          }
                        }}
                        options={statusDropdownOptions}
                        value={tenant.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted">{tenant.postgresConnection?.name || "Not attached"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex max-w-56 rounded-full border border-line bg-panel2 px-3 py-1 text-xs font-semibold text-muted">
                        <span className="truncate">{pipelineSummary(tenant)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{tenant.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 text-xs font-semibold"
                          onClick={() => {
                            toast.info("Opening bakery details", tenant.name);
                            setSupportTenant(tenant);
                          }}
                          title="View details"
                        >
                          <Eye size={16} />
                          View
                        </button>
                        <button className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 text-xs font-semibold" onClick={() => openEdit(tenant)} title="Edit bakery">
                          <Edit3 size={16} />
                          Edit
                        </button>
                        <button className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 text-xs font-semibold" onClick={() => openPipeline(tenant)} title="Order pipeline">
                          <Workflow size={16} />
                          Pipeline
                        </button>
                        <button
                          className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 text-xs font-semibold text-berry"
                          onClick={() => {
                            toast.warning("Delete confirmation required", `${tenant.name} will not be deleted until you confirm.`);
                            setDeleteTenant(tenant);
                          }}
                          title="Delete bakery"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Modal
          open={createOpen}
          title="Onboard Bakery"
          description={`Tenant slug will be auto-generated as: ${generatedSlug || "enter-bakery-name"}`}
          onClose={() => setCreateOpen(false)}
        >
          <form className="grid gap-3" onSubmit={onboardTenant}>
            {[
              ["bakeryName", "Bakery name"],
              ["ownerName", "Owner name"],
              ["ownerEmail", "Owner email"],
              ["ownerPassword", "Owner password"],
              ["phone", "Phone"],
              ["address", "Address"],
              ["managerName", "Manager name"],
              ["managerEmail", "Manager email"],
              ["managerPhone", "Manager phone"],
              ["managerPassword", "Manager password"],
              ["monthlyAmount", "Amount per month"],
              ["lastPaymentDate", "Last payment date"],
              ["lastPaymentAmount", "Last payment amount"],
              ["nextDueDate", "Next due date"]
            ].map(([key, label]) => (
              <label key={key} className="grid gap-1">
                <span className="text-sm font-medium">{label}</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                  type={key.includes("Date") ? "date" : key.includes("Password") ? "password" : key.includes("Email") ? "email" : key.includes("Amount") ? "number" : "text"}
                  value={form[key as keyof OnboardForm]}
                />
              </label>
            ))}
            <label className="grid gap-1">
              <span className="text-sm font-medium">Postgres DB</span>
              <select
                className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                onChange={(event) => setForm((current) => ({ ...current, postgresConnectionId: event.target.value }))}
                value={form.postgresConnectionId}
              >
                <option value="">No DB attached yet</option>
                {availablePostgresConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Recurrence</span>
              <select
                className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value as OnboardForm["recurrence"] }))}
                value={form.recurrence}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="EVERY_2_MONTHS">Every 2 months</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </label>
            {form.recurrence === "CUSTOM" ? (
              <label className="grid gap-1">
                <span className="text-sm font-medium">Custom recurrence months</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  min={1}
                  onChange={(event) => setForm((current) => ({ ...current, recurrenceMonths: event.target.value }))}
                  type="number"
                  value={form.recurrenceMonths}
                />
              </label>
            ) : null}
            <label className="grid gap-1">
              <span className="text-sm font-medium">Billing status</span>
              <select
                className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                onChange={(event) => setForm((current) => ({ ...current, billingStatus: event.target.value as OnboardForm["billingStatus"] }))}
                value={form.billingStatus}
              >
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="OVERDUE">Overdue</option>
                <option value="WAIVED">Waived</option>
              </select>
            </label>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setCreateOpen(false)} type="button">
                Cancel
              </button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">
                {saving ? "Creating..." : "Create Bakery"}
              </button>
            </div>
          </form>
        </Modal>

        <Modal
          open={Boolean(editTenant && editForm)}
          title="Edit Bakery"
          description={editTenant ? `Update details for ${editTenant.name}.` : ""}
          onClose={() => {
            setEditTenant(null);
            setEditForm(null);
          }}
        >
          {editForm ? (
            <form className="grid gap-3" onSubmit={updateTenant}>
              {[
                ["bakeryName", "Bakery name"],
                ["ownerEmail", "Owner email"],
                ["phone", "Phone"],
                ["address", "Address"]
              ].map(([key, label]) => (
                <label key={key} className="grid gap-1">
                  <span className="text-sm font-medium">{label}</span>
                  <input
                    className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                    onChange={(event) => setEditForm((current) => (current ? { ...current, [key]: event.target.value } : current))}
                    type={key === "ownerEmail" ? "email" : "text"}
                    value={editForm[key as keyof EditForm]}
                  />
                </label>
              ))}
              <label className="grid gap-1">
                <span className="text-sm font-medium">Postgres DB</span>
                <select
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setEditForm((current) => (current ? { ...current, postgresConnectionId: event.target.value } : current))}
                  value={editForm.postgresConnectionId}
                >
                  <option value="">No DB attached yet</option>
                  {editPostgresConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">Status</span>
                <select
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setEditForm((current) => (current ? { ...current, status: event.target.value as TenantStatus } : current))}
                  value={editForm.status}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold"
                  onClick={() => {
                    setEditTenant(null);
                    setEditForm(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          ) : null}
        </Modal>

        <Modal open={Boolean(supportTenant)} title="Bakery Details" description="Read-only support and billing view." onClose={() => setSupportTenant(null)}>
          {supportTenant ? (
            <div className="grid gap-4 text-sm">
              {(() => {
                const subscription = supportTenant.subscriptions?.[0];
                const sections = [
                  {
                    title: "Bakery",
                    rows: [
                      ["Name", supportTenant.name],
                      ["Tenant ID", supportTenant.id],
                      ["Slug", supportTenant.slug],
                      ["Status", supportTenant.status],
                      ["Currency", supportTenant.currency],
                      ["Tax label", supportTenant.taxLabel]
                    ]
                  },
                  {
                    title: "Owner And Contact",
                    rows: [
                      ["Owner email", supportTenant.ownerEmail],
                      ["Phone", supportTenant.phone || "-"],
                      ["Address", supportTenant.address || "-"],
                      ["Postgres DB", supportTenant.postgresConnection?.name || "Not attached"]
                    ]
                  },
                  {
                    title: "Billing",
                    rows: [
                      ["Amount per month", subscription ? formatAmount(subscription.monthlyAmount, supportTenant.currency) : "-"],
                      ["Recurrence", formatRecurrence(subscription)],
                      ["Subscription status", subscription?.status || "-"],
                      ["Billing status", subscription?.billingStatus || "-"],
                      ["Last payment date", formatDate(subscription?.lastPaymentDate)],
                      ["Covered period", formatPeriod(subscription?.lastPaymentPeriodFrom, subscription?.lastPaymentPeriodTo)],
                      ["Last payment amount", subscription ? formatAmount(subscription.lastPaymentAmount, supportTenant.currency) : "-"],
                      ["Next due date", formatDate(subscription?.nextDueDate)]
                    ]
                  },
                  {
                    title: "System",
                    rows: [
                      ["Created", formatDate(supportTenant.createdAt)],
                      ["Updated", formatDate(supportTenant.updatedAt)],
                      ["Subscription ID", subscription?.id || "-"],
                      ["Subscription updated", formatDate(subscription?.updatedAt)]
                    ]
                  }
                ];

                return sections.map((section) => (
                  <section key={section.title} className="rounded-lg border border-line bg-panel2 p-3">
                    <h3 className="font-semibold">{section.title}</h3>
                    <dl className="mt-3 grid gap-2">
                      {section.rows.map(([label, value]) => (
                        <div key={label} className="grid gap-1 border-b border-line/70 pb-2 last:border-0 last:pb-0 sm:grid-cols-[150px_1fr]">
                          <dt className="text-muted">{label}</dt>
                          <dd className="break-words font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                ));
              })()}
              <div className="mt-2 flex justify-end">
                <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" onClick={() => setSupportTenant(null)}>
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </Modal>

        <Modal
          open={Boolean(pipelineTenant)}
          title="Order Pipeline"
          description={pipelineTenant ? `Configure order flow for ${pipelineTenant.name}.` : ""}
          onClose={() => {
            setPipelineTenant(null);
            setPipelineForm(null);
          }}
        >
          {pipelineLoading ? <LoadingSpinner label="Loading pipeline" /> : null}
          {pipelineForm ? (
            <div className="grid gap-5 text-sm">
              <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Pipeline</p>
                  <p className="text-xs text-muted">{pipelineForm.enabled ? "Active" : "Inactive"}</p>
                </div>
                <button
                  aria-checked={pipelineForm.enabled}
                  className={`focus-ring inline-flex h-8 w-14 items-center rounded-full p-1 transition ${switchClass(pipelineForm.enabled)}`}
                  onClick={() => setPipelineForm((current) => (current ? { ...current, enabled: !current.enabled } : current))}
                  role="switch"
                  type="button"
                >
                  <span className={`h-6 w-6 rounded-full bg-white shadow-subtle transition ${pipelineForm.enabled ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="rounded-lg border border-line bg-panel2 p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center">
                  {pipelineForm.stages.map((stage, index) => {
                    const active = pipelineForm.enabled && stage.enabled;
                    return (
                      <div key={stage.key} className="contents">
                        <section className={`relative min-h-40 rounded-lg border bg-panel p-4 shadow-subtle transition ${active ? "border-mint/50" : "border-line opacity-60"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? "border-mint/30 bg-mint/10 text-mint" : "border-line bg-panel2 text-muted"}`}>
                              {active ? "Active" : "Inactive"}
                            </span>
                            <button
                              aria-checked={stage.enabled}
                              className={`focus-ring inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${stage.enabled && pipelineForm.enabled ? "bg-mint" : "bg-slate-300"}`}
                              disabled={!pipelineForm.enabled}
                              onClick={() =>
                                setPipelineForm((current) =>
                                  current
                                    ? {
                                        ...current,
                                        stages: current.stages.map((item) =>
                                          item.key === stage.key ? { ...item, enabled: !item.enabled } : item
                                        )
                                      }
                                    : current
                                )
                              }
                              role="switch"
                              type="button"
                            >
                              <span className={`h-5 w-5 rounded-full bg-white shadow-subtle transition ${stage.enabled && pipelineForm.enabled ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>
                          <div className="mt-8">
                            <p className="text-xs font-semibold uppercase text-muted">Stage {index + 1}</p>
                            <h3 className="mt-2 text-lg font-semibold">{actorLabels[stage.actorType]}</h3>
                            <p className="mt-1 text-sm text-muted">{stage.label}</p>
                          </div>
                        </section>
                        {index < pipelineForm.stages.length - 1 ? (
                          <div className={`flex items-center justify-center text-muted lg:h-full ${active ? "text-mint" : ""}`}>
                            <div className="hidden h-px w-12 bg-current lg:block" />
                            <ArrowRight className="hidden lg:block" size={20} />
                            <div className="h-8 w-px bg-current lg:hidden" />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold"
                  onClick={() => {
                    setPipelineTenant(null);
                    setPipelineForm(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} onClick={savePipeline} type="button">
                  {saving ? "Saving..." : "Save Pipeline"}
                </button>
              </div>
            </div>
          ) : null}
        </Modal>

        <ConfirmModal
          open={Boolean(statusAction)}
          title="Confirm status change"
          description={statusAction ? `${statusAction.tenant.name} status will be changed to ${statusAction.status}.` : ""}
          confirmLabel="Confirm Change"
          variant={statusAction?.status === "SUSPENDED" ? "danger" : "default"}
          loading={saving}
          onClose={() => setStatusAction(null)}
          onConfirm={() => {
            if (statusAction) updateTenantStatus(statusAction.tenant.id, statusAction.status);
          }}
        />

        <ConfirmModal
          open={Boolean(deleteTenant)}
          title="Delete bakery?"
          description={deleteTenant ? `${deleteTenant.name} and its tenant-owned records will be permanently deleted.` : ""}
          confirmLabel="Delete Bakery"
          variant="danger"
          loading={saving}
          onClose={() => setDeleteTenant(null)}
          onConfirm={removeTenant}
        />
      </div>
    </AppShell>
  );
}
