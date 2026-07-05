"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, RefreshCw, Search, UserPlus } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { PaginationControls, usePagination } from "../../../components/pagination";
import { PhotoPicker } from "../../../components/photo-picker";
import { SearchableSelect } from "../../../components/searchable-select";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Route = {
  id: string;
  name: string;
  active: boolean;
};

type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  aadhaarNumber?: string | null;
  aadhaarPhotoUrl?: string | null;
  address?: string | null;
  state?: string | null;
  city?: string | null;
  notes?: string | null;
  creditLimit?: string | number | null;
  dueBalance?: number;
  paidTotal?: number;
  orderTotal?: number;
  creditExceeded?: boolean;
  route?: Route | null;
  createdAt: string;
};
type CustomerLedger = {
  customer: Customer;
  summary: { orderTotal: number; paidTotal: number; dueBalance: number; creditLimit: number | null; creditExceeded: boolean };
  entries: { id: string; type: string; date: string; description: string; debit: number; credit: number; invoiceNumber?: string | null }[];
  productPrices: { id: string; price: string | number; product: { name: string } }[];
};

const stateCityMap: Record<string, string[]> = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Tirupati"],
  Assam: ["Guwahati", "Dibrugarh", "Silchar", "Jorhat"],
  Bihar: ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur"],
  Delhi: ["New Delhi", "Dwarka", "Rohini", "Saket", "Karol Bagh"],
  Goa: ["Panaji", "Margao", "Mapusa", "Vasco da Gama"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar"],
  Haryana: ["Gurugram", "Faridabad", "Panipat", "Ambala"],
  Karnataka: ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi"],
  Kerala: ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur"],
  "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad"],
  Punjab: ["Ludhiana", "Amritsar", "Jalandhar", "Patiala"],
  Rajasthan: ["Jaipur", "Udaipur", "Jodhpur", "Kota", "Ajmer"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"],
  Telangana: ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra", "Noida"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Siliguri"]
};

const initialCustomerForm = {
  name: "",
  email: "",
  phone: "",
  aadhaarNumber: "",
  aadhaarPhotoUrl: "",
  address: "",
  state: "Gujarat",
  city: "Ahmedabad",
  routeId: "",
  creditLimit: "",
  notes: ""
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function formatAmount(value?: string | number | null) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function BakeryCustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<CustomerLedger | null>(null);
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);
  const [search, setSearch] = useState("");

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";
  const cities = stateCityMap[customerForm.state] || [];
  const routeOptions = useMemo(() => routes.filter((route) => route.active).map((route) => ({ value: route.id, label: route.name })), [routes]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.aadhaarNumber, customer.city, customer.state, customer.route?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [customers, search]);
  const customersPage = usePagination(filteredCustomers, 25);

  async function loadData() {
    if (!apiBase) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [customerData, routeData] = await Promise.all([
        authFetch<{ customers: Customer[] }>(`${apiBase}/customers`),
        authFetch<{ routes: Route[] }>(`${apiBase}/routes`)
      ]);
      setCustomers(customerData.customers);
      setRoutes(routeData.routes);
    } catch (error) {
      toast.error("Could not load customers", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/customers`, {
        method: "POST",
        body: JSON.stringify({
          ...customerForm,
          routeId: customerForm.routeId || undefined,
          email: customerForm.email || undefined,
          creditLimit: customerForm.creditLimit ? Number(customerForm.creditLimit) : undefined,
          tags: []
        })
      });
      toast.success("Customer created", `${customerForm.name} was added and assigned to the selected route.`);
      setCustomerForm(initialCustomerForm);
      setCustomerOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Customer creation failed", error instanceof Error ? error.message : "Could not create customer.");
    } finally {
      setSaving(false);
    }
  }

  function openEditCustomer(customer: Customer) {
    setEditCustomer(customer);
    setCustomerForm({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      aadhaarNumber: customer.aadhaarNumber || "",
      aadhaarPhotoUrl: customer.aadhaarPhotoUrl || "",
      address: customer.address || "",
      state: customer.state || "Gujarat",
      city: customer.city || "Ahmedabad",
      routeId: customer.route?.id || "",
      creditLimit: customer.creditLimit ? String(customer.creditLimit) : "",
      notes: customer.notes || ""
    });
    setCustomerOpen(true);
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editCustomer) {
      if (!apiBase) return;
      setSaving(true);
      try {
        await authFetch(`${apiBase}/customers/${editCustomer.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...customerForm,
            routeId: customerForm.routeId || undefined,
            email: customerForm.email || undefined,
            creditLimit: customerForm.creditLimit ? Number(customerForm.creditLimit) : undefined,
            tags: []
          })
        });
        toast.success("Customer updated", `${customerForm.name} details were saved.`);
        setEditCustomer(null);
        setCustomerForm(initialCustomerForm);
        setCustomerOpen(false);
        await loadData();
      } catch (error) {
        toast.error("Customer update failed", error instanceof Error ? error.message : "Could not update customer.");
      } finally {
        setSaving(false);
      }
      return;
    }
    await createCustomer(event);
  }

  async function openLedger(customer: Customer) {
    if (!apiBase) return;
    try {
      const data = await authFetch<{ ledger: CustomerLedger }>(`${apiBase}/customers/${customer.id}/ledger`);
      setLedger(data.ledger);
    } catch (error) {
      toast.error("Could not load ledger", error instanceof Error ? error.message : "Please try again.");
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Customer records, Aadhaar details, routes, and delivery addresses" surface="bakery">
      <div className="grid gap-4">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-end">
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setCustomerOpen(true)}>
                <UserPlus size={16} />
                Add Customer
              </button>
              <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh customers">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="border-b border-line p-3">
            <label className="flex max-w-md items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Search size={16} className="text-muted" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, phone, Aadhaar, city, or route"
                value={search}
              />
            </label>
          </div>

          {loading ? <LoadingSpinner label="Loading customers" /> : null}
          <PaginationControls
            {...customersPage}
            summary={[
              { label: "Routes", value: routes.length },
              { label: "Aadhaar", value: customers.filter((customer) => customer.aadhaarNumber).length },
              { label: "Due", value: formatAmount(customers.reduce((sum, customer) => sum + Number(customer.dueBalance || 0), 0)) }
            ]}
          />

          <div className="grid gap-3 p-3 sm:hidden">
            {customersPage.pageItems.map((customer) => (
              <article key={customer.id} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{customer.name}</h3>
                    <p className="truncate text-xs text-muted">{customer.phone || "No phone"} · {customer.city || "No city"}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-mint/30 bg-mint/10 px-2 py-1 text-xs font-semibold text-mint">
                    {customer.route?.name || "No route"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <span>
                    <span className="block text-xs text-muted">Due</span>
                    <span className={customer.creditExceeded ? "font-semibold text-berry" : "font-semibold"}>{formatAmount(customer.dueBalance)}</span>
                  </span>
                  <span>
                    <span className="block text-xs text-muted">Credit</span>
                    <span className="font-semibold">{customer.creditLimit ? formatAmount(customer.creditLimit) : "-"}</span>
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs text-muted">{customer.address || "No address"}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openLedger(customer)} title="View ledger" type="button"><Eye size={15} /></button>
                  <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openEditCustomer(customer)} title="Edit customer" type="button"><Pencil size={15} /></button>
                </div>
              </article>
            ))}
            {!loading && !filteredCustomers.length ? (
              <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No customers found.</p>
            ) : null}
          </div>

          <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">City/State</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-right">Credit Limit</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customersPage.pageItems.map((customer) => (
                  <tr key={customer.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex gap-1.5 pt-0.5">
                          <button className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-line bg-panel2" onClick={() => openLedger(customer)} title="View ledger" type="button"><Eye size={15} /></button>
                          <button className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-line bg-panel2" onClick={() => openEditCustomer(customer)} title="Edit customer" type="button"><Pencil size={15} /></button>
                        </div>
                        <span>
                          <span className="block font-semibold">{customer.name}</span>
                          <span className="text-xs text-muted">{customer.email || "No email"}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{customer.phone || "-"}</td>
                    
                    <td className="px-4 py-3">{[customer.city, customer.state].filter(Boolean).join(", ") || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border border-mint/30 bg-mint/10 px-2 py-1 text-xs font-semibold text-mint">
                        {customer.route?.name || "No route"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${customer.creditExceeded ? "text-berry" : ""}`}>{formatAmount(customer.dueBalance)}</td>
                    <td className="px-4 py-3 text-right">
                      {customer.creditLimit ? (
                        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${customer.creditExceeded ? "border-berry/30 bg-berry/10 text-berry" : "border-line bg-panel2"}`}>
                          {formatAmount(customer.creditLimit)}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-muted">{customer.address || "-"}</td>
                    <td className="px-4 py-3">{formatDate(customer.createdAt)}</td>
                  </tr>
                ))}
                {!loading && !filteredCustomers.length ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-muted" colSpan={8}>No customers found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <Modal open={customerOpen} title={editCustomer ? "Edit Customer" : "Add Customer"} description="Create a bakery customer and assign the route where material or product will go." onClose={() => { setCustomerOpen(false); setEditCustomer(null); setCustomerForm(initialCustomerForm); }}>
          <form className="grid gap-3" onSubmit={saveCustomer}>
            {[
              ["name", "Name"],
              ["phone", "Mobile number"],
              ["email", "Email"],
              ["aadhaarNumber", "Aadhaar card number"],
              ["address", "Address"],
              ["creditLimit", "Credit limit"],
              ["notes", "Notes"]
            ].map(([key, label]) => (
              <label key={key} className="grid gap-1">
                <span className="text-sm font-medium">{label}</span>
                <input
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setCustomerForm((current) => ({ ...current, [key]: event.target.value }))}
                  type={key === "email" ? "email" : key === "creditLimit" ? "number" : "text"}
                  value={customerForm[key as keyof typeof customerForm]}
                />
              </label>
            ))}
            <PhotoPicker
              label="Aadhaar card photo"
              onChange={(fileName) => setCustomerForm((current) => ({ ...current, aadhaarPhotoUrl: fileName }))}
              value={customerForm.aadhaarPhotoUrl}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-medium">State</span>
                <select
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => {
                    const state = event.target.value;
                    setCustomerForm((current) => ({ ...current, state, city: stateCityMap[state]?.[0] || "" }));
                  }}
                  value={customerForm.state}
                >
                  {Object.keys(stateCityMap).map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">City</span>
                <select
                  className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setCustomerForm((current) => ({ ...current, city: event.target.value }))}
                  value={customerForm.city}
                >
                  {cities.map((city) => <option key={city} value={city}>{city}</option>)}
                </select>
              </label>
            </div>
            <SearchableSelect label="Route" onChange={(value) => setCustomerForm((current) => ({ ...current, routeId: value }))} options={routeOptions} placeholder="No route" searchPlaceholder="Search routes" value={customerForm.routeId} />
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => { setCustomerOpen(false); setEditCustomer(null); setCustomerForm(initialCustomerForm); }} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : editCustomer ? "Save Customer" : "Create Customer"}</button>
            </div>
          </form>
        </Modal>

        <Modal open={Boolean(ledger)} title="Customer ledger" description="Orders, payments, credit limit, and customer-specific prices." onClose={() => setLedger(null)}>
          {ledger ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-muted">
                <span>Orders: <span className="font-semibold text-ink">{formatAmount(ledger.summary.orderTotal)}</span></span>
                <span>Paid: <span className="font-semibold text-ink">{formatAmount(ledger.summary.paidTotal)}</span></span>
                <span>Due: <span className="font-semibold text-ink">{formatAmount(ledger.summary.dueBalance)}</span></span>
                <span>Credit: <span className="font-semibold text-ink">{ledger.summary.creditLimit === null ? "-" : formatAmount(ledger.summary.creditLimit)}</span></span>
              </div>
              {ledger.summary.creditExceeded ? <p className="rounded-md border border-berry/30 bg-berry/10 px-3 py-2 text-sm font-semibold text-berry">Credit limit exceeded</p> : null}
              <div className="max-h-[360px] w-full max-w-full overflow-auto rounded-lg border border-line">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ledger.entries.map((entry) => (
                      <tr key={entry.id}><td className="px-4 py-3">{formatDate(entry.date)}</td><td className="px-4 py-3">{entry.type}</td><td className="px-4 py-3">{entry.description}</td><td className="px-4 py-3 text-right">{entry.debit ? formatAmount(entry.debit) : "-"}</td><td className="px-4 py-3 text-right">{entry.credit ? formatAmount(entry.credit) : "-"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Modal>

      </div>
    </AppShell>
  );
}
