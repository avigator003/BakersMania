import Link from "next/link";
import { Building2, ShieldCheck, ShoppingBag } from "lucide-react";

const surfaces = [
  {
    href: "/admin",
    title: "Platform Admin",
    body: "Onboard bakeries, inspect tenant data, manage subscriptions, and support owners.",
    icon: ShieldCheck
  },
  {
    href: "/bakery",
    title: "Bakery CRM",
    body: "Run orders, customers, invoices, inventory, staff, routes, and daily reporting.",
    icon: Building2
  },
  {
    href: "/customer",
    title: "Customer Portal",
    body: "Let customers place orders, track invoices, and reuse the same order flow as staff.",
    icon: ShoppingBag
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-night px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="grid min-h-[calc(100vh-48px)] content-center gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-mint">BakersMania PWA</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-ink sm:text-6xl">
              Bakery CRM for orders, customers, stock, staff, and billing.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
              One SaaS platform for your admin account, bakery owner workspace, staff operations, and customer ordering portal.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="focus-ring rounded-md bg-mint px-5 py-3 font-semibold text-white" href="/bakery">
                Open CRM
              </Link>
              <Link className="focus-ring rounded-md border border-line bg-panel px-5 py-3 font-semibold" href="/customer">
                Customer Portal
              </Link>
            </div>
          </div>
          <div className="grid gap-3">
            {surfaces.map((surface) => {
              const Icon = surface.icon;
              return (
                <Link key={surface.href} href={surface.href} className="focus-ring rounded-lg border border-line bg-panel p-5 shadow-subtle">
                  <div className="flex items-start gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-md bg-mint text-white">
                      <Icon size={22} />
                    </span>
                    <span>
                      <span className="block text-lg font-semibold">{surface.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted">{surface.body}</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
