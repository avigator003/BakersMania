"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Edit3, Eye, Trash2, UserPlus } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { ConfirmModal, Modal } from "../../../components/modal";
import { StatusDropdown } from "../../../components/status-dropdown";
import { useToast } from "../../../components/toast-provider";
import { authFetch } from "../../../lib/api";
import { localDateInput } from "../../../components/date-input";

type TenantStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "SUSPENDED";
type BillingStatus = "PENDING" | "PAID" | "OVERDUE" | "WAIVED";

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
  createdAt: string;
  updatedAt: string;
  subscriptions?: TenantSubscription[];
};

type OnboardForm = {
  bakeryName: string;
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
};

const statusOptions: TenantStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "SUSPENDED"];
const statusDropdownOptions = [
  { value: "TRIALING" as const, label: "Trialing", className: "border-saffron/30 bg-saffron/10 text-saffron" },
  { value: "ACTIVE" as const, label: "Active", className: "border-mint/30 bg-mint/10 text-mint" },
  { value: "PAST_DUE" as const, label: "Past due", className: "border-berry/30 bg-berry/10 text-berry" },
  { value: "CANCELED" as const, label: "Canceled", className: "border-slate-400/30 bg-slate-100 text-slate-600" },
  { value: "SUSPENDED" as const, label: "Suspended", className: "border-berry/30 bg-berry/10 text-berry" }
];

const initialForm: OnboardForm = {
  bakeryName: "Demo Cakes",
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
    status: tenant.status
  };
}

export default function AdminTenantsPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState<OnboardForm>(initialForm);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [supportTenant, setSupportTenant] = useState<Tenant | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [deleteTenant, setDeleteTenant] = useState<Tenant | null>(null);
  const [statusAction, setStatusAction] = useState<{ tenant: Tenant; status: TenantStatus } | null>(null);

  const generatedSlug = slugify(form.bakeryName);

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

  useEffect(() => {
    loadTenants();
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
          lastPaymentAmount: form.lastPaymentAmount ? Number(form.lastPaymentAmount) : undefined
        })
      });
      toast.success("Bakery onboarded", `${form.bakeryName} was created successfully.`);
      setForm(initialForm);
      setCreateOpen(false);
      await loadTenants();
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
        body: JSON.stringify(editForm)
      });
      toast.success("Bakery updated", `${editForm.bakeryName} details were saved.`);
      setEditTenant(null);
      setEditForm(null);
      await loadTenants();
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
          status
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
    } catch (error) {
      toast.error("Delete failed", error instanceof Error ? error.message : "Could not delete bakery.");
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
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel"
                    onClick={() => {
                      toast.info("Opening bakery details", tenant.name);
                      setSupportTenant(tenant);
                    }}
                    title="View details"
                  >
                    <Eye size={16} />
                  </button>
                  <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openEdit(tenant)} title="Edit bakery">
                    <Edit3 size={16} />
                  </button>
                  <button
                    className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel text-berry"
                    onClick={() => {
                      toast.warning("Delete confirmation required", `${tenant.name} will not be deleted until you confirm.`);
                      setDeleteTenant(tenant);
                    }}
                    title="Delete bakery"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden w-full max-w-full overflow-x-auto sm:block">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Bakery</th>
                  <th className="px-4 py-3 font-semibold">Slug</th>
                  <th className="px-4 py-3 font-semibold">Owner Email</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
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
                    <td className="px-4 py-3 text-muted">{tenant.phone || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2"
                          onClick={() => {
                            toast.info("Opening bakery details", tenant.name);
                            setSupportTenant(tenant);
                          }}
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => openEdit(tenant)} title="Edit bakery">
                          <Edit3 size={16} />
                        </button>
                        <button
                          className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2 text-berry"
                          onClick={() => {
                            toast.warning("Delete confirmation required", `${tenant.name} will not be deleted until you confirm.`);
                            setDeleteTenant(tenant);
                          }}
                          title="Delete bakery"
                        >
                          <Trash2 size={16} />
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
                      ["Address", supportTenant.address || "-"]
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
