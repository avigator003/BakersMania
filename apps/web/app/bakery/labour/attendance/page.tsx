"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../../../../components/shell";
import { useToast } from "../../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../../lib/api";
import { downloadLabourAttendanceWorkbook, fetchLabourYearExport } from "../../../../lib/labour-export";

type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "PAID_LEAVE" | "UNPAID_LEAVE";

type Labour = {
  id: string;
  name: string;
  phone?: string | null;
  skill?: string | null;
  dailyWage?: string | null;
  active: boolean;
};

type Attendance = {
  id: string;
  labourId?: string | null;
  status: AttendanceStatus;
  notes?: string | null;
};

type LabourDashboard = {
  labours: Labour[];
  todayAttendance: Attendance[];
};

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatAmount(value?: string | number | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function statusClass(status: AttendanceStatus) {
  if (status === "PRESENT") return "border-mint/30 bg-mint/10 text-mint";
  if (status === "ABSENT") return "border-berry/30 bg-berry/10 text-berry";
  if (status === "HALF_DAY") return "border-saffron/30 bg-saffron/10 text-saffron";
  return "border-slate-400/30 bg-slate-100 text-slate-600";
}

export default function LabourAttendancePage() {
  const toast = useToast();
  const [date, setDate] = useState(todayInput());
  const [labours, setLabours] = useState<Labour[]>([]);
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()));
  const [exporting, setExporting] = useState(false);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiPath = tenantSlug ? `/t/${tenantSlug}/staff` : "";

  const activeLabours = useMemo(() => labours.filter((labour) => labour.active), [labours]);
  const visibleLabours = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeLabours;
    return activeLabours.filter((labour) =>
      [labour.name, labour.phone, labour.skill]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [activeLabours, search]);

  const counts = useMemo(() => {
    return activeLabours.reduce(
      (summary, labour) => {
        const status = draft[labour.id]?.status || "PRESENT";
        summary[status] += 1;
        return summary;
      },
      { PRESENT: 0, HALF_DAY: 0, ABSENT: 0, PAID_LEAVE: 0, UNPAID_LEAVE: 0 } as Record<AttendanceStatus, number>
    );
  }, [activeLabours, draft]);

  async function loadAttendance(nextDate = date) {
    if (!apiPath) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch<LabourDashboard>(`${apiPath}/labour?date=${nextDate}`);
      const active = response.labours.filter((labour) => labour.active);
      setLabours(response.labours);
      setDraft(
        Object.fromEntries(
          active.map((labour) => {
            const saved = response.todayAttendance.find((attendance) => attendance.labourId === labour.id);
            return [
              labour.id,
              {
                status: saved?.status || "PRESENT",
                notes: saved?.notes || ""
              }
            ];
          })
        )
      );
    } catch (error) {
      toast.error("Could not load attendance", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAttendance();
  }, []);

  async function saveAttendance() {
    if (!apiPath) return;
    setSaving(true);
    try {
      await Promise.all(
        activeLabours.map((labour) => {
          const row = draft[labour.id] || { status: "PRESENT", notes: "" };
          return authFetch(`${apiPath}/attendance`, {
            method: "POST",
            body: JSON.stringify({
              labourId: labour.id,
              workDate: date,
              status: row.status,
              notes: row.notes
            })
          });
        })
      );
      toast.success("Attendance saved", `${activeLabours.length} labour records updated for the selected date.`);
      await loadAttendance(date);
    } catch (error) {
      toast.error("Attendance save failed", error instanceof Error ? error.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadAttendanceExcel() {
    if (!tenantSlug) {
      toast.error("Bakery slug missing", "Please sign in again.");
      return;
    }

    setExporting(true);
    try {
      const exportData = await fetchLabourYearExport(tenantSlug, Number(exportYear));
      downloadLabourAttendanceWorkbook(exportData);
      toast.success("Attendance Excel downloaded", `Year-wise attendance sheet for ${exportData.year} is ready.`);
    } catch (error) {
      toast.error("Excel download failed", error instanceof Error ? error.message : "Could not create attendance sheet.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Daily labour attendance sheet" surface="bakery">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel p-5 shadow-subtle">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-mint">Labour Attendance</p>
              <h1 className="mt-2 text-2xl font-bold">Daily Attendance Sheet</h1>
              <p className="mt-2 text-sm text-muted">Mark all active labourers together. Existing marks stay visible when you reopen the date.</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Export year</span>
                <input
                  className="w-28 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  max="2100"
                  min="2000"
                  onChange={(event) => setExportYear(event.target.value)}
                  type="number"
                  value={exportYear}
                />
              </label>
              <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" disabled={exporting} onClick={downloadAttendanceExcel}>
                <Download size={16} />
                {exporting ? "Preparing..." : "Attendance Excel"}
              </button>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">Date</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => {
                    setDate(event.target.value);
                    loadAttendance(event.target.value);
                  }}
                  type="date"
                  value={date}
                />
              </label>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={() => loadAttendance(date)} title="Refresh attendance">
                <RefreshCw size={16} />
              </button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving || !activeLabours.length} onClick={saveAttendance}>
                {saving ? "Saving..." : "Save Attendance"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex max-w-md items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Search size={16} className="text-muted" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search labour"
                value={search}
              />
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              <span>Full: <span className="font-semibold text-ink">{counts.PRESENT}</span></span>
              <span>Half: <span className="font-semibold text-ink">{counts.HALF_DAY}</span></span>
              <span>Absent: <span className="font-semibold text-ink">{counts.ABSENT}</span></span>
              <span>Active: <span className="font-semibold text-ink">{activeLabours.length}</span></span>
            </div>
          </div>

          {loading ? <p className="p-4 text-sm text-muted">Loading attendance...</p> : null}

          <div className="divide-y divide-line">
            {visibleLabours.map((labour) => {
              const row = draft[labour.id] || { status: "PRESENT", notes: "" };
              return (
                <div key={labour.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_420px_280px] lg:items-center">
                  <div>
                    <p className="font-semibold">{labour.name}</p>
                    <p className="text-sm text-muted">{labour.skill || "General labour"} · {labour.phone || "No phone"} · {formatAmount(labour.dailyWage)} daily</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["PRESENT", "Full day"],
                      ["HALF_DAY", "Half day"],
                      ["ABSENT", "Absent"]
                    ].map(([status, label]) => {
                      const active = row.status === status;
                      return (
                        <button
                          key={status}
                          className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold ${active ? statusClass(status as AttendanceStatus) : "border-line bg-panel2 text-muted"}`}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              [labour.id]: { ...row, status: status as AttendanceStatus }
                            }))
                          }
                          type="button"
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-mint"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [labour.id]: { ...row, notes: event.target.value }
                      }))
                    }
                    placeholder="Note"
                    value={row.notes}
                  />
                </div>
              );
            })}
            {!loading && !visibleLabours.length ? <p className="p-4 text-sm text-muted">No labour found.</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
