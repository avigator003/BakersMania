import Link from "next/link";
import { Building2, CreditCard, Database, PhoneCall } from "lucide-react";
import { AppShell } from "../../components/shell";

const modules = [
  { href: "/admin/tenants", label: "Bakery onboarding", icon: Building2, body: "Create, suspend, activate, and support bakery tenants." },
  { href: "/admin/leads", label: "Bakery leads", icon: PhoneCall, body: "Record calls, status, location, and today’s follow-ups." },
  { href: "/admin/postgres-connections", label: "Postgres DBs", icon: Database, body: "Create database connections and attach one to each bakery." },
  { href: "/admin/billing", label: "Billing", icon: CreditCard, body: "Review subscriptions, trials, and payment states." }
];

export default function AdminPage() {
  return (
    <AppShell title="Platform Admin" subtitle="Onboarding, support, subscriptions, and full tenant visibility" surface="admin">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel p-5 shadow-subtle">
          <p className="text-sm font-semibold uppercase text-mint">Platform overview</p>
          <h1 className="mt-2 text-2xl font-bold">Admin command center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Manage the whole BakersMania SaaS platform from clear, route-based sections.
          </p>
        </section>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.href} href={module.href} className="focus-ring rounded-lg border border-line bg-panel p-4 shadow-subtle hover:border-mint">
                <Icon className="text-mint" size={22} />
                <h2 className="mt-4 font-semibold">{module.label}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{module.body}</p>
              </Link>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
