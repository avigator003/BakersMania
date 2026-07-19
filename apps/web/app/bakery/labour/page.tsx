"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CalendarCheck, Download, IndianRupee, Pencil, RefreshCw, Search, UserPlus } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaginationControls } from "../../../components/pagination";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";
import { downloadLabourAttendanceWorkbook, downloadLabourOverviewWorkbook, fetchLabourYearExport } from "../../../lib/labour-export";

type Labour = {
  id: string;
  name: string;
  phone?: string | null;
  role: string;
  skill?: string | null;
  dateOfBirth?: string | null;
  dailyWage?: string | null;
  monthlySalary?: string | null;
  active: boolean;
  joinedAt: string;
  notes?: string | null;
  attendance: Attendance[];
  salaryPayments: SalaryPayment[];
};

type Attendance = {
  id: string;
  labourId?: string | null;
  workDate: string;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "PAID_LEAVE" | "UNPAID_LEAVE";
  notes?: string | null;
  labour?: Labour | null;
};

type SalaryPayment = {
  id: string;
  labourId?: string | null;
  amount: string;
  period: string;
  paymentType: "ADVANCE" | "PARTIAL" | "FULL";
  reason?: string | null;
  method?: string | null;
  reference?: string | null;
  paidAt: string;
  notes?: string | null;
  labour?: Labour | null;
};

type LabourDashboard = {
  stats: {
    totalLabour: number;
    activeLabour: number;
    presentToday: number;
    absentToday: number;
    paymentThisMonth: number;
    advanceThisMonth: number;
    partialThisMonth: number;
  };
  labours: Labour[];
  todayAttendance: Attendance[];
  pagination?: PaginationMeta;
};

type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type StatusFilter = "active" | "inactive" | "all";

const initialLabourForm = {
  name: "",
  phone: "",
  skill: "",
  dateOfBirth: "",
  dailyWage: "",
  monthlySalary: "",
  joinedAt: localDateInput(),
  notes: ""
};

function formatAmount(value?: string | number | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function labourAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return "-";
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return "-";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age >= 0 ? String(age) : "-";
}

export default function LabourManagementPage() {
  const toast = useToast();
  const [data, setData] = useState<LabourDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [labourOpen, setLabourOpen] = useState(false);
  const [editLabour, setEditLabour] = useState<Labour | null>(null);
  const [labourForm, setLabourForm] = useState(initialLabourForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [updatingLabourId, setUpdatingLabourId] = useState<string | null>(null);
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState<"overview" | "attendance" | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiPath = tenantSlug ? `/t/${tenantSlug}/staff` : "";

  async function loadLabour() {
    if (!apiPath) {
      toast.error("Bakery slug missing", "Please sign in again so the workspace route can be resolved.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const response = await authFetch<LabourDashboard>(`${apiPath}/labour?${params.toString()}`);
      setData(response);
      setTotal(response.pagination?.total ?? response.labours.length);
      setPageCount(response.pagination?.pageCount ?? 1);
      setPage(response.pagination?.page ?? page);
      setPageSize(response.pagination?.pageSize ?? pageSize);
    } catch (error) {
      toast.error("Could not load labour management", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLabour();
  }, [page, pageSize, search, statusFilter]);

  function openEditLabour(labour: Labour) {
    setEditLabour(labour);
    setLabourForm({
      name: labour.name || "",
      phone: labour.phone || "",
      skill: labour.skill || "",
      dateOfBirth: labour.dateOfBirth ? labour.dateOfBirth.slice(0, 10) : "",
      dailyWage: labour.dailyWage ? String(labour.dailyWage) : "",
      monthlySalary: labour.monthlySalary ? String(labour.monthlySalary) : "",
      joinedAt: labour.joinedAt ? labour.joinedAt.slice(0, 10) : localDateInput(),
      notes: labour.notes || ""
    });
    setLabourOpen(true);
  }

  function closeLabourModal() {
    setLabourOpen(false);
    setEditLabour(null);
    setLabourForm(initialLabourForm);
  }

  async function saveLabour(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiPath) return;
    setSaving(true);
    try {
      const payload = {
        ...labourForm,
        role: "LABOURER",
        dailyWage: labourForm.dailyWage ? Number(labourForm.dailyWage) : undefined,
        monthlySalary: labourForm.monthlySalary ? Number(labourForm.monthlySalary) : undefined,
        dateOfBirth: labourForm.dateOfBirth || undefined,
        joinedAt: labourForm.joinedAt || undefined
      };
      if (editLabour) {
        await authFetch(`${apiPath}/labour/${editLabour.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        toast.success("Labour updated", `${labourForm.name} details were saved.`);
      } else {
        await authFetch(`${apiPath}/labour`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast.success("Labour created", `${labourForm.name} was added to the bakery workforce.`);
      }
      closeLabourModal();
      await loadLabour();
    } catch (error) {
      toast.error(editLabour ? "Labour update failed" : "Labour creation failed", error instanceof Error ? error.message : "Could not save labour.");
    } finally {
      setSaving(false);
    }
  }

  async function updateLabourStatus(labour: Labour, active: boolean) {
    if (!apiPath || labour.active === active) return;
    setUpdatingLabourId(labour.id);
    try {
      await authFetch(`${apiPath}/labour/${labour.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active })
      });
      setData((current) =>
        current
          ? {
              ...current,
              stats: {
                ...current.stats,
                activeLabour: current.labours.filter((item) => (item.id === labour.id ? active : item.active)).length
              },
              labours: current.labours.map((item) => (item.id === labour.id ? { ...item, active } : item))
            }
          : current
      );
      toast.success(active ? "Labour activated" : "Labour marked inactive", `${labour.name} status was updated.`);
    } catch (error) {
      toast.error("Status update failed", error instanceof Error ? error.message : "Could not update labour status.");
    } finally {
      setUpdatingLabourId(null);
    }
  }

  async function downloadYearExport(type: "overview" | "attendance") {
    if (!tenantSlug) {
      toast.error("Bakery slug missing", "Please sign in again.");
      return;
    }

    setExporting(type);
    try {
      const exportData = await fetchLabourYearExport(tenantSlug, Number(exportYear));
      if (type === "overview") {
        downloadLabourOverviewWorkbook(exportData);
      } else {
        downloadLabourAttendanceWorkbook(exportData);
      }
      toast.success("Excel downloaded", `${type === "overview" ? "Labour overview" : "Attendance"} sheet for ${exportData.year} is ready.`);
    } catch (error) {
      toast.error("Excel download failed", error instanceof Error ? error.message : "Could not create Excel sheet.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Labour attendance, advances, partial payments, and salary records" surface="bakery">
      <div className="grid gap-4">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-end">
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <label className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold">
                <span className="text-muted">Year</span>
                <input
                  className="w-20 bg-transparent outline-none"
                  max="2100"
                  min="2000"
                  onChange={(event) => setExportYear(event.target.value)}
                  type="number"
                  value={exportYear}
                />
              </label>
              <button
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold"
                disabled={exporting !== null}
                onClick={() => downloadYearExport("overview")}
              >
                <Download size={16} />
                {exporting === "overview" ? "Preparing..." : "Overview Excel"}
              </button>
              <button
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold"
                disabled={exporting !== null}
                onClick={() => downloadYearExport("attendance")}
              >
                <Download size={16} />
                {exporting === "attendance" ? "Preparing..." : "Attendance Excel"}
              </button>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => { setEditLabour(null); setLabourForm(initialLabourForm); setLabourOpen(true); }}>
                <UserPlus size={16} />
                Add Labour
              </button>
              <Link className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" href="labour/attendance">
                <CalendarCheck size={16} />
                Attendance Sheet
              </Link>
              <Link className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" href="labour/payments">
                <IndianRupee size={16} />
                Payment Sheet
              </Link>
              <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={() => loadLabour()} title="Refresh labour">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {loading ? <LoadingSpinner label="Loading labour" /> : null}
          <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex max-w-md flex-1 items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Search size={16} className="text-muted" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Search labour by name, phone, skill, or role"
                value={search}
              />
            </label>
            <div className="inline-grid grid-cols-3 rounded-md border border-line bg-panel2 p-1 text-sm font-semibold">
              {[
                ["active", "Active"],
                ["inactive", "Inactive"],
                ["all", "All"]
              ].map(([value, label]) => (
                <button
                  className={`focus-ring rounded px-3 py-1.5 ${statusFilter === value ? "bg-mint text-white" : "text-muted hover:text-ink"}`}
                  key={value}
                  onClick={() => { setStatusFilter(value as StatusFilter); setPage(1); }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <PaginationControls
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize}
            total={total}
            summary={[
              { label: "Active", value: data?.stats.activeLabour ?? 0 },
              { label: "Present", value: data?.stats.presentToday ?? 0 },
              { label: "Absent", value: data?.stats.absentToday ?? 0 },
              { label: "Paid", value: formatAmount(data?.stats.paymentThisMonth ?? 0) },
              { label: "Advances", value: formatAmount(data?.stats.advanceThisMonth ?? 0) }
            ]}
          />

          <div className="grid gap-3 p-3 sm:hidden">
            {(data?.labours || []).map((labour) => {
              return (
                <article key={labour.id} className="rounded-lg border border-line bg-panel2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{labour.name}</h3>
                      <p className="text-xs text-muted">{labour.phone || "No phone"}</p>
                    </div>
                    <select
                      className={`focus-ring shrink-0 rounded-md border px-2 py-1 text-xs font-semibold outline-none ${
                        labour.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"
                      }`}
                      disabled={updatingLabourId === labour.id}
                      onChange={(event) => updateLabourStatus(labour, event.target.value === "active")}
                      value={labour.active ? "active" : "inactive"}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <span>
                      <span className="block text-xs text-muted">Age</span>
                      <span className="font-semibold">{labourAge(labour.dateOfBirth)}</span>
                    </span>
                    <span>
                      <span className="block text-xs text-muted">Daily wage</span>
                      <span className="font-semibold">{formatAmount(labour.dailyWage)}</span>
                    </span>
                    <span>
                      <span className="block text-xs text-muted">Monthly</span>
                      <span className="font-semibold">{formatAmount(labour.monthlySalary)}</span>
                    </span>
                  </div>
                  <button className="focus-ring mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line bg-panel text-sm font-semibold" onClick={() => openEditLabour(labour)} type="button">
                    <Pencil size={15} />
                    Edit Details
                  </button>
                </article>
              );
            })}
            {!loading && !(data?.labours || []).length ? (
              <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No labour matched your search.</p>
            ) : null}
          </div>

          <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Labour</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3">Daily wage</th>
                  <th className="px-4 py-3">Monthly salary</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(data?.labours || []).map((labour) => {
                  return (
                    <tr key={labour.id}>
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{labour.name}</span>
                        <span className="text-xs text-muted">{labour.phone || "No phone"}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{labourAge(labour.dateOfBirth)}</td>
                      <td className="px-4 py-3">{formatAmount(labour.dailyWage)}</td>
                      <td className="px-4 py-3">{formatAmount(labour.monthlySalary)}</td>
                      <td className="px-4 py-3">
                        <select
                          className={`focus-ring rounded-md border px-2 py-1 text-xs font-semibold outline-none ${
                            labour.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"
                          }`}
                          disabled={updatingLabourId === labour.id}
                          onChange={(event) => updateLabourStatus(labour, event.target.value === "active")}
                          value={labour.active ? "active" : "inactive"}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="table-action-grid table-action-grid--compact">
                          <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold hover:border-mint" onClick={() => openEditLabour(labour)} type="button">
                            <Pencil size={15} />
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !(data?.labours || []).length ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-muted" colSpan={6}>
                      No labour matched your search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <Modal open={labourOpen} title={editLabour ? "Edit Labour" : "Add Labour"} description={editLabour ? "Update labour profile details used for attendance and salary calculations." : "Create a bakery labour profile for attendance and payment tracking."} onClose={closeLabourModal}>
          <form className="grid gap-3" onSubmit={saveLabour}>
            {[
              ["name", "Name"],
              ["phone", "Phone"],
              ["skill", "Skill"],
              ["dateOfBirth", "Date of birth"],
              ["dailyWage", "Daily wage"],
              ["monthlySalary", "Monthly salary"],
              ["joinedAt", "Joined date"],
              ["notes", "Notes"]
            ].map(([key, label]) => (
              <label key={key} className="grid gap-1">
                <span className="text-sm font-medium">{label}</span>
                {key === "joinedAt" || key === "dateOfBirth" ? (
                  <DateInput
                    className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                    onChange={(value) => setLabourForm((current) => ({ ...current, [key]: value }))}
                    value={labourForm[key as keyof typeof labourForm]}
                  />
                ) : (
                  <input
                    className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                    onChange={(event) => setLabourForm((current) => ({ ...current, [key]: event.target.value }))}
                    type={key.toLowerCase().includes("wage") || key.toLowerCase().includes("salary") ? "number" : "text"}
                    value={labourForm[key as keyof typeof labourForm]}
                  />
                )}
              </label>
            ))}
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={closeLabourModal} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : editLabour ? "Save Labour" : "Create Labour"}</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
