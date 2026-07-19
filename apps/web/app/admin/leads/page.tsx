"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Edit3, PhoneCall, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { ConfirmModal, Modal } from "../../../components/modal";
import { StatusDropdown } from "../../../components/status-dropdown";
import { useToast } from "../../../components/toast-provider";
import { authFetch } from "../../../lib/api";
import { localDateInput } from "../../../components/date-input";

type LeadStatus = "REJECTED" | "PENDING" | "IN_PROCESS" | "ACCEPTED";
type LeadTab = "all" | "today";

type BakeryLead = {
  id: string;
  phone: string;
  ownerName: string;
  bakeryName: string;
  city: string;
  state: string;
  said: string;
  status: LeadStatus;
  nextCallAt: string;
  createdAt: string;
  updatedAt: string;
};

type LeadForm = {
  phone: string;
  ownerName: string;
  bakeryName: string;
  city: string;
  state: string;
  said: string;
  status: LeadStatus;
  nextCallAt: string;
};

const initialForm: LeadForm = {
  phone: "",
  ownerName: "",
  bakeryName: "",
  city: "",
  state: "",
  said: "",
  status: "PENDING",
  nextCallAt: localDateInput()
};

const statusOptions = [
  { value: "PENDING" as const, label: "Pending", className: "border-saffron/30 bg-saffron/10 text-saffron" },
  { value: "IN_PROCESS" as const, label: "In-process", className: "border-blue-400/30 bg-blue-50 text-blue-700" },
  { value: "ACCEPTED" as const, label: "Accepted", className: "border-mint/30 bg-mint/10 text-mint" },
  { value: "REJECTED" as const, label: "Rejected", className: "border-berry/30 bg-berry/10 text-berry" }
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function toLeadForm(lead: BakeryLead): LeadForm {
  return {
    phone: lead.phone,
    ownerName: lead.ownerName,
    bakeryName: lead.bakeryName,
    city: lead.city,
    state: lead.state,
    said: lead.said,
    status: lead.status,
    nextCallAt: localDateInput(new Date(lead.nextCallAt))
  };
}

export default function AdminLeadsPage() {
  const toast = useToast();
  const [leads, setLeads] = useState<BakeryLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<LeadTab>("all");
  const [statusFilter, setStatusFilter] = useState<"" | LeadStatus>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(initialForm);
  const [editLead, setEditLead] = useState<BakeryLead | null>(null);
  const [deleteLead, setDeleteLead] = useState<BakeryLead | null>(null);

  const today = localDateInput();

  const stats = useMemo(() => {
    const pending = leads.filter((lead) => lead.status === "PENDING").length;
    const inProcess = leads.filter((lead) => lead.status === "IN_PROCESS").length;
    const accepted = leads.filter((lead) => lead.status === "ACCEPTED").length;
    const rejected = leads.filter((lead) => lead.status === "REJECTED").length;
    return [
      ["Visible", String(leads.length)],
      ["Pending", String(pending)],
      ["In-process", String(inProcess)],
      ["Accepted", String(accepted)],
      ["Rejected", String(rejected)]
    ];
  }, [leads]);

  async function loadLeads(nextTab = tab, nextStatus = statusFilter) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextTab === "today") {
        params.set("view", "today");
        params.set("date", today);
      }
      if (nextStatus) params.set("status", nextStatus);
      const data = await authFetch<{ leads: BakeryLead[] }>(`/platform-admin/leads${params.size ? `?${params}` : ""}`);
      setLeads(data.leads);
    } catch (error) {
      toast.error("Could not load bakery leads", error instanceof Error ? error.message : "Please check API and admin login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  async function saveLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        nextCallAt: form.nextCallAt || today
      };
      if (editLead) {
        await authFetch(`/platform-admin/leads/${editLead.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        toast.success("Lead updated", `${form.bakeryName} was saved.`);
      } else {
        await authFetch("/platform-admin/leads", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast.success("Lead added", `${form.bakeryName} was added to bakery leads.`);
      }
      setCreateOpen(false);
      setEditLead(null);
      setForm(initialForm);
      await loadLeads();
    } catch (error) {
      toast.error("Save failed", error instanceof Error ? error.message : "Could not save bakery lead.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(lead: BakeryLead, status: LeadStatus) {
    if (lead.status === status) return;
    try {
      await authFetch(`/platform-admin/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      toast.success("Status updated", `${lead.bakeryName} is now ${status}.`);
      await loadLeads();
    } catch (error) {
      toast.error("Status update failed", error instanceof Error ? error.message : "Could not update lead status.");
    }
  }

  async function removeLead() {
    if (!deleteLead) return;
    setSaving(true);
    try {
      await authFetch(`/platform-admin/leads/${deleteLead.id}`, { method: "DELETE" });
      toast.success("Lead deleted", `${deleteLead.bakeryName} was removed.`);
      setDeleteLead(null);
      await loadLeads();
    } catch (error) {
      toast.error("Delete failed", error instanceof Error ? error.message : "Could not delete bakery lead.");
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditLead(null);
    setForm(initialForm);
    setCreateOpen(true);
  }

  function openEdit(lead: BakeryLead) {
    setEditLead(lead);
    setForm(toLeadForm(lead));
    setCreateOpen(true);
  }

  return (
    <AppShell title="Platform Admin" subtitle="Bakery leads, call notes, and today’s follow-ups" surface="admin">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-4 border-b border-line p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <PhoneCall className="text-mint" size={20} />
                  <h1 className="text-xl font-semibold">Bakery Leads</h1>
                </div>
                <p className="mt-1 text-sm text-muted">Track phone calls, what they said, location, status, and next call date.</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
                {stats.map(([label, value]) => (
                  <span key={label}>{label}: <span className="font-semibold text-ink">{value}</span></span>
                ))}
              </div>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={openCreate}>
                  <Plus size={16} />
                  Add Lead
                </button>
                <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={() => loadLeads()}>
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto] lg:items-end">
              <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-panel2 p-1">
                {[
                  ["all", "All Leads"],
                  ["today", "Today’s Calling"]
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`focus-ring rounded-md px-3 py-2 text-sm font-semibold ${tab === value ? "bg-mint text-white" : "text-muted hover:text-ink"}`}
                    onClick={() => {
                      const nextTab = value as LeadTab;
                      setTab(nextTab);
                      loadLeads(nextTab, statusFilter);
                    }}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Status</span>
                <select
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none"
                  onChange={(event) => {
                    const nextStatus = event.target.value as "" | LeadStatus;
                    setStatusFilter(nextStatus);
                    loadLeads(tab, nextStatus);
                  }}
                  value={statusFilter}
                >
                  <option value="">All status</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROCESS">In-process</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </label>
              <div className="text-sm text-muted">
                {tab === "today" ? <>Showing next calls for <span className="font-semibold text-ink">{formatDate(today)}</span></> : "Showing every saved lead"}
              </div>
            </div>
          </div>

          {loading ? <LoadingSpinner label="Loading bakery leads" /> : null}

          {!loading && leads.length === 0 ? (
            <div className="p-6 text-sm text-muted">
              {tab === "today" ? "No calls scheduled for today." : "No bakery leads saved yet."}
            </div>
          ) : null}

          <div className="grid gap-3 p-3 sm:hidden">
            {leads.map((lead) => (
              <article key={lead.id} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{lead.bakeryName}</h3>
                    <p className="truncate text-xs text-muted">{lead.ownerName} · {lead.city}, {lead.state} · {lead.phone}</p>
                  </div>
                  <StatusDropdown onChange={(status) => updateStatus(lead, status)} options={statusOptions} value={lead.status} />
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6">{lead.said}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-md bg-panel px-3 py-2">Next: {formatDate(lead.nextCallAt)}</span>
                  <span className="rounded-md bg-panel px-3 py-2">Updated: {formatDate(lead.updatedAt)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openEdit(lead)} title="Edit lead">
                    <Edit3 size={16} />
                  </button>
                  <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel text-berry" onClick={() => setDeleteLead(lead)} title="Delete lead">
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden w-full max-w-full overflow-x-auto sm:block">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Bakery</th>
                  <th className="px-4 py-3 font-semibold">Owner</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">City / State</th>
                  <th className="px-4 py-3 font-semibold">What they said</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Next call</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leads.map((lead) => (
                  <tr key={lead.id} className="align-top">
                    <td className="px-4 py-3 font-semibold">{lead.bakeryName}</td>
                    <td className="px-4 py-3 text-muted">{lead.ownerName}</td>
                    <td className="px-4 py-3 text-muted">{lead.phone}</td>
                    <td className="px-4 py-3 text-muted">{lead.city}, {lead.state}</td>
                    <td className="max-w-sm px-4 py-3">
                      <p className="line-clamp-3 leading-6">{lead.said}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusDropdown onChange={(status) => updateStatus(lead, status)} options={statusOptions} value={lead.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(lead.nextCallAt)}</td>
                    <td className="px-4 py-3">
                      <div className="table-action-grid table-action-grid--compact">
                        <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2" onClick={() => openEdit(lead)} title="Edit lead">
                          <Edit3 size={16} />
                        </button>
                        <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2 text-berry" onClick={() => setDeleteLead(lead)} title="Delete lead">
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
          title={editLead ? "Edit Bakery Lead" : "Add Bakery Lead"}
          description="Save the call details and the next follow-up date."
          onClose={() => {
            setCreateOpen(false);
            setEditLead(null);
            setForm(initialForm);
          }}
        >
          <form className="grid gap-3" onSubmit={saveLead}>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Phone number</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required type="tel" value={form.phone} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Bakery name</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, bakeryName: event.target.value }))} required value={form.bakeryName} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Owner name</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, ownerName: event.target.value }))} required value={form.ownerName} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-medium">City</span>
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} required value={form.city} />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">State</span>
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} required value={form.state} />
              </label>
            </div>
            <label className="grid gap-1">
              <span className="text-sm font-medium">What they said</span>
              <textarea className="min-h-28 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, said: event.target.value }))} required value={form.said} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-medium">Status</span>
                <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as LeadStatus }))} value={form.status}>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROCESS">In-process</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">When to call next time</span>
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, nextCallAt: event.target.value }))} required type="date" value={form.nextCallAt} />
              </label>
            </div>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold"
                onClick={() => {
                  setCreateOpen(false);
                  setEditLead(null);
                  setForm(initialForm);
                }}
                type="button"
              >
                Cancel
              </button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">
                {saving ? "Saving..." : editLead ? "Save Changes" : "Create Lead"}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmModal
          open={Boolean(deleteLead)}
          title="Delete bakery lead?"
          description={deleteLead ? `${deleteLead.bakeryName} will be removed from leads.` : ""}
          confirmLabel="Delete Lead"
          variant="danger"
          loading={saving}
          onClose={() => setDeleteLead(null)}
          onConfirm={removeLead}
        />
      </div>
    </AppShell>
  );
}
