"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { DateInput, localDateInput, localMonthInput } from "../../../components/date-input";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaginationControls } from "../../../components/pagination";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Vehicle = {
  id: string;
  name: string;
  number?: string | null;
};

type Route = {
  id: string;
  name: string;
  vehicle?: Vehicle | null;
};

type Expense = {
  id: string;
  type: "RENT" | "MISCELLANEOUS";
  category: string;
  status: "PENDING" | "PAID" | "CANCELED";
  recurring: boolean;
  recurringRootId?: string | null;
  periodMonth?: string | null;
  amount: string | number;
  notes?: string | null;
  spentAt: string;
  route?: Route | null;
};

type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type ExpenseSummary = {
  total: number;
  paid: number;
  pending: number;
  rent: number;
};

const initialMonth = localMonthInput();
const initialDate = localDateInput();

const initialForm = {
  type: "RENT" as "RENT" | "MISCELLANEOUS",
  routeId: "",
  name: "",
  amount: "",
  status: "PENDING" as "PENDING" | "PAID" | "CANCELED",
  recurring: true,
  spentAt: initialDate,
  notes: ""
};

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function statusClass(status: Expense["status"]) {
  if (status === "PAID") return "border-mint/30 bg-mint/10 text-mint";
  if (status === "CANCELED") return "border-slate-400/30 bg-slate-100 text-slate-600";
  return "border-amber-400/40 bg-amber-100 text-amber-700";
}

export default function BakeryExpensesPage() {
  const toast = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(initialMonth);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<ExpenseSummary>({ total: 0, paid: 0, pending: 0, rent: 0 });
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [form, setForm] = useState(initialForm);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";
  const routeOptions = useMemo(() => routes.map((route) => ({
    value: route.id,
    label: route.name,
    description: route.vehicle?.name || route.vehicle?.number || undefined
  })), [routes]);

  async function loadData() {
    if (!apiBase) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("month", month);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const [expenseData, routeData] = await Promise.all([
        authFetch<{ expenses: Expense[]; pagination?: PaginationMeta; summary?: ExpenseSummary }>(`${apiBase}/finance/expenses?${params.toString()}`),
        authFetch<{ routes: Route[] }>(`${apiBase}/routes?pageSize=100`)
      ]);
      setExpenses(expenseData.expenses);
      setTotal(expenseData.pagination?.total ?? expenseData.expenses.length);
      setPageCount(expenseData.pagination?.pageCount ?? 1);
      setPage(expenseData.pagination?.page ?? page);
      setPageSize(expenseData.pagination?.pageSize ?? pageSize);
      setTotals(expenseData.summary ?? { total: 0, paid: 0, pending: 0, rent: 0 });
      setRoutes(routeData.routes);
    } catch (error) {
      toast.error("Could not load expenses", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [month, typeFilter, statusFilter, page, pageSize, search]);

  async function createExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/finance/expenses`, {
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          category: form.type === "RENT" ? "Route Rent" : form.name,
          routeId: form.type === "RENT" ? form.routeId : undefined,
          status: form.status,
          recurring: form.recurring,
          amount: Number(form.amount || 0),
          spentAt: form.spentAt,
          notes: form.notes || undefined
        })
      });
      toast.success("Expense created", `${form.type === "RENT" ? "Rent" : form.name} expense was added.`);
      setForm(initialForm);
      setExpenseOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Expense creation failed", error instanceof Error ? error.message : "Could not create expense.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(expense: Expense, status: Expense["status"]) {
    if (!apiBase) return;
    try {
      await authFetch(`${apiBase}/finance/expenses/${expense.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      toast.success("Expense status updated", `${expense.category} is now ${status.toLowerCase()}.`);
      await loadData();
    } catch (error) {
      toast.error("Status update failed", error instanceof Error ? error.message : "Could not update expense status.");
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Rent and miscellaneous expense tracking" surface="bakery">
      <div className="grid gap-4">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-3 xl:flex-row xl:items-center xl:justify-end">
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setExpenseOpen(true)} type="button">
                <Plus size={16} />
                Add Expense
              </button>
              <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh expenses" type="button">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-line p-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
            <label className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Search size={16} className="text-muted" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search route, name, note"
                value={search}
              />
            </label>
            <input className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => { setMonth(event.target.value); setPage(1); }} type="month" value={month} />
            <select className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} value={typeFilter}>
              <option value="all">All types</option>
              <option value="RENT">Rent</option>
              <option value="MISCELLANEOUS">Miscellaneous</option>
            </select>
            <select className="rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold outline-none focus:border-mint" onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} value={statusFilter}>
              <option value="all">All status</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>

          {loading ? <LoadingSpinner label="Loading expenses" /> : null}
          <PaginationControls
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize}
            total={total}
            summary={[
              { label: "Month total", value: formatAmount(totals.total) },
              { label: "Paid", value: formatAmount(totals.paid) },
              { label: "Pending", value: formatAmount(totals.pending) },
              { label: "Rent", value: formatAmount(totals.rent) }
            ]}
          />

          <div className="grid gap-3 p-3 sm:hidden">
            {expenses.map((expense) => (
              <article key={expense.id} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{expense.type === "RENT" ? expense.route?.name || "Route rent" : expense.category}</h3>
                    <p className="text-xs text-muted">{expense.type === "RENT" ? "Rent" : "Miscellaneous"} · {formatDate(expense.spentAt)}</p>
                  </div>
                  <span className="shrink-0 font-semibold">{formatAmount(expense.amount)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <select
                    className={`rounded-md border px-2 py-2 text-xs font-semibold outline-none ${statusClass(expense.status)}`}
                    onChange={(event) => updateStatus(expense, event.target.value as Expense["status"])}
                    value={expense.status}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID</option>
                    <option value="CANCELED">CANCELED</option>
                  </select>
                  <span className="rounded-md border border-line bg-panel px-2 py-2 text-center text-xs font-semibold">
                    {expense.recurring ? "Monthly" : "One time"}
                  </span>
                </div>
                {expense.notes ? <p className="mt-3 text-xs text-muted">{expense.notes}</p> : null}
              </article>
            ))}
            {!loading && !expenses.length ? (
              <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No expenses found for this filter.</p>
            ) : null}
          </div>

          <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Name / Route</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Repeat</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
              {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-4 py-3">{formatDate(expense.spentAt)}</td>
                    <td className="px-4 py-3">{expense.type === "RENT" ? "Rent" : "Miscellaneous"}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{expense.type === "RENT" ? expense.route?.name || "Route rent" : expense.category}</span>
                      {expense.type === "RENT" ? <span className="text-xs text-muted">{expense.route?.vehicle?.name || "No vehicle"}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAmount(expense.amount)}</td>
                    <td className="px-4 py-3">
                      <select
                        className={`rounded-md border px-2 py-1 text-xs font-semibold outline-none ${statusClass(expense.status)}`}
                        onChange={(event) => updateStatus(expense, event.target.value as Expense["status"])}
                        value={expense.status}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PAID">PAID</option>
                        <option value="CANCELED">CANCELED</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {expense.recurring ? (
                        <span className="rounded-md border border-mint/30 bg-mint/10 px-2 py-1 text-xs font-semibold text-mint">
                          Monthly
                        </span>
                      ) : (
                        <span className="text-xs text-muted">One time</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{expense.notes || "-"}</td>
                  </tr>
                ))}
                {!loading && !expenses.length ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted" colSpan={7}>No expenses found for this filter.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal open={expenseOpen} title="Add expense" description="Record route rent or miscellaneous bakery expenses." onClose={() => setExpenseOpen(false)}>
        <form className="grid gap-4" onSubmit={createExpense}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Type
              <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as "RENT" | "MISCELLANEOUS" }))} value={form.type}>
                <option value="RENT">Rent</option>
                <option value="MISCELLANEOUS">Miscellaneous</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Status
              <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "PENDING" | "PAID" | "CANCELED" }))} value={form.status}>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="CANCELED">Canceled</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold">
              <input
                checked={form.recurring}
                onChange={(event) => setForm((current) => ({ ...current, recurring: event.target.checked }))}
                type="checkbox"
              />
              Carry forward monthly
            </label>
            {form.type === "RENT" ? (
              <SearchableSelect label="Route" onChange={(value) => setForm((current) => ({ ...current, routeId: value }))} options={routeOptions} placeholder="Select route" required searchPlaceholder="Search routes" value={form.routeId} />
            ) : (
              <label className="grid gap-1 text-sm font-semibold">
                Name
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Electricity, cleaning, repair" required value={form.name} />
              </label>
            )}
            <label className="grid gap-1 text-sm font-semibold">
              Amount
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" min="0.01" onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required step="0.01" type="number" value={form.amount} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Date
              <DateInput className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(value) => setForm((current) => ({ ...current, spentAt: value }))} value={form.spentAt} />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">
            Notes
            <textarea className="min-h-20 rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional" value={form.notes} />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setExpenseOpen(false)} type="button">Cancel</button>
            <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Create Expense"}</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
