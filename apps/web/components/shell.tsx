"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  Database,
  Home,
  IndianRupee,
  KeyRound,
  LogOut,
  Menu,
  PhoneCall,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  X
} from "lucide-react";
import { PwaRegister } from "./pwa-register";
import {
  apiFetch,
  authFetch,
  clearSession,
  getStoredActorType,
  getStoredTenantName,
  getStoredTenantSlug,
  getStoredToken,
  storeTenantName
} from "../lib/api";

const bakeryNav = [
  { href: "/bakery", label: "Dashboard", icon: Home },
  { href: "/bakery/orders", label: "Orders", icon: ClipboardList },
  { href: "/bakery/truck-loading", label: "Truck Loading", icon: Truck },
  { href: "/bakery/customers", label: "Customers", icon: Users },
  { href: "/bakery/products", label: "Products", icon: Boxes },
  { href: "/bakery/prices", label: "Product Prices", icon: IndianRupee },
  { href: "/bakery/categories", label: "Product Categories", icon: Boxes },
  { href: "/bakery/labour", label: "Labour", icon: Users },
  { href: "/bakery/inventory", label: "Inventory", icon: Boxes },
  { href: "/bakery/expenses", label: "Expenses", icon: CreditCard },
  { href: "/bakery/routes", label: "Routes", icon: Truck },
  { href: "/bakery/route-invoices", label: "Route Invoices", icon: CreditCard },
  { href: "/bakery/passwords", label: "Password", icon: KeyRound },
];

const sessionVerificationTtlMs = 60_000;

function sessionVerificationKey(token: string, actorType: string) {
  return `bakersmania_session_verified_at:${actorType}:${token.slice(-12)}`;
}

function hasFreshSessionVerification(token: string, actorType: string) {
  if (typeof window === "undefined") return false;
  const value = window.sessionStorage.getItem(sessionVerificationKey(token, actorType));
  const verifiedAt = value ? Number(value) : 0;
  return Number.isFinite(verifiedAt) && Date.now() - verifiedAt < sessionVerificationTtlMs;
}

function markSessionVerified(token: string, actorType: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(sessionVerificationKey(token, actorType), String(Date.now()));
}

type CustomerRouteSummary = {
  routeName: string;
  vehicleName: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
};

type VehicleRouteSummary = {
  routeName: string;
  driverName: string;
  driverPhone: string;
};

type AccountSummary = {
  name: string;
  phone?: string | null;
  email?: string | null;
};

export function AppShell({
  title,
  subtitle,
  children,
  surface = "bakery"
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  surface?: "bakery" | "admin" | "customer" | "vehicle";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "allowed" | "denied">(() => {
    const token = getStoredToken();
    const actorType = getStoredActorType();
    return token && actorType === (surface === "admin" ? "platform_admin" : surface === "customer" ? "customer" : surface === "vehicle" ? "vehicle" : "bakery_user")
      ? "allowed"
      : "checking";
  });
  const [workspaceName, setWorkspaceName] = useState(surface === "bakery" || surface === "customer" || surface === "vehicle" ? getStoredTenantName() || "" : "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [customerRoute, setCustomerRoute] = useState<CustomerRouteSummary | null>(null);
  const [vehicleRoute, setVehicleRoute] = useState<VehicleRouteSummary | null>(null);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);

  const requiredActor =
    surface === "admin" ? "platform_admin" : surface === "customer" ? "customer" : surface === "vehicle" ? "vehicle" : "bakery_user";
  const loginPath =
    surface === "admin" ? "/login/admin" : surface === "customer" ? "/login/customer" : surface === "vehicle" ? "/login/vehicle" : "/login/bakery";
  const pathSegments = pathname.split("/").filter(Boolean);
  const pathTenantSlug =
    pathSegments.length > 1 && (pathSegments[1] === "bakery" || pathSegments[1] === "customer" || pathSegments[1] === "vehicle")
      ? pathSegments[0]
      : "";
  const storedTenantSlug = getStoredTenantSlug() || "";
  const tenantSlug = pathTenantSlug || storedTenantSlug;
  const routeBase = surface === "admin" || !tenantSlug ? "" : `/${tenantSlug}`;
  const shellTitle = (surface === "bakery" || surface === "customer" || surface === "vehicle") && workspaceName ? workspaceName : title;

  const footerCopy =
    surface === "admin"
      ? {
          title: "Platform Admin",
          body: "Manage bakeries, billing, support, and platform controls"
        }
      : surface === "customer"
        ? {
            title: "Customer Portal",
            body: "Shop, orders, and invoices"
          }
        : surface === "vehicle"
          ? {
              title: "Vehicle Workspace",
              body: "Assigned routes, delivery status, and truck loading"
            }
        : {
            title: "Bakery Workspace",
            body: "Orders, staff, stock, routes, and customers"
          };

  useEffect(() => {
    let cancelled = false;

    async function verifyAccess() {
      const token = getStoredToken();
      const actorType = getStoredActorType();
      const sessionTenantSlug = getStoredTenantSlug();

      if (!token || actorType !== requiredActor) {
        clearSession();
        if (!cancelled) {
          setAuthState("denied");
          router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
        }
        return;
      }

      if (!cancelled) setAuthState("allowed");

      if (hasFreshSessionVerification(token, requiredActor)) {
        return;
      }

      if ((surface === "bakery" || surface === "customer" || surface === "vehicle") && sessionTenantSlug) {
        const surfaceSegment = surface;
        const expectedPrefix = `/${sessionTenantSlug}/${surfaceSegment}`;
        const legacyPrefix = `/${surfaceSegment}`;

        if (pathname.startsWith(legacyPrefix) || (pathTenantSlug && !pathname.startsWith(expectedPrefix))) {
          const suffix = pathname.startsWith(legacyPrefix) ? pathname.slice(legacyPrefix.length) : pathname.split(`/${surfaceSegment}`)[1] || "";
          if (!cancelled) {
            router.replace(`${expectedPrefix}${suffix}`);
          }
          return;
        }
      }

      try {
        const data = await authFetch<{ session: { actorType: string }; user?: AccountSummary | null }>("/auth/me");
        if (data.session.actorType !== requiredActor) {
          throw new Error("Wrong actor type");
        }
        if (!cancelled && data.user) {
          setAccountSummary(data.user);
        }
        markSessionVerified(token, requiredActor);
        if (!cancelled) setAuthState("allowed");
      } catch {
        clearSession();
        if (!cancelled) {
          setAuthState("denied");
          router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
        }
      }
    }

    verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [pathTenantSlug, pathname, requiredActor, router, surface]);

  useEffect(() => {
    let cancelled = false;

    async function loadAccountSummary() {
      if (surface === "admin") {
        setAccountSummary(null);
        return;
      }
      try {
        const data = await authFetch<{ session: { actorType: string }; user?: AccountSummary | null }>("/auth/me");
        if (!cancelled) setAccountSummary(data.user || null);
      } catch {
        if (!cancelled) setAccountSummary(null);
      }
    }

    if (authState === "allowed") {
      void loadAccountSummary();
    }
    return () => {
      cancelled = true;
    };
  }, [authState, surface]);

  useEffect(() => {
    let cancelled = false;

    async function loadTenantName() {
      if ((surface !== "bakery" && surface !== "customer" && surface !== "vehicle") || !tenantSlug) return;

      const storedName = getStoredTenantName();
      if (storedName && !workspaceName) {
        setWorkspaceName(storedName);
      }
      if (storedName) return;

      try {
        const data = await apiFetch<{ tenant: { name: string } }>(`/tenants/${tenantSlug}/public`);
        if (!cancelled) {
          setWorkspaceName(data.tenant.name);
          storeTenantName(data.tenant.name);
        }
      } catch {
        if (!cancelled && !workspaceName) {
          setWorkspaceName(title);
        }
      }
    }

    loadTenantName();
    return () => {
      cancelled = true;
    };
  }, [surface, tenantSlug, title, workspaceName]);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomerRoute() {
      if (surface !== "customer" || !tenantSlug) {
        setCustomerRoute(null);
        return;
      }

      try {
        const data = await authFetch<{
          profile: {
            customer?: {
              route?: {
                name?: string | null;
                vehicle?: {
                  name?: string | null;
                  number?: string | null;
                  driverName?: string | null;
                  driverPhone?: string | null;
                } | null;
              } | null;
            };
            route?: {
              name?: string | null;
              vehicle?: {
                name?: string | null;
                number?: string | null;
                driverName?: string | null;
                driverPhone?: string | null;
              } | null;
            } | null;
          };
        }>(`/t/${tenantSlug}/customers/me`);
        const route = data.profile.customer?.route || data.profile.route;
        const vehicle = route?.vehicle;
        if (!cancelled) {
          setCustomerRoute({
            routeName: route?.name || "No route assigned",
            vehicleName: vehicle?.name || "No vehicle assigned",
            vehicleNumber: vehicle?.number || "",
            driverName: vehicle?.driverName || "No driver assigned",
            driverPhone: vehicle?.driverPhone || ""
          });
        }
      } catch {
        if (!cancelled) setCustomerRoute(null);
      }
    }

    loadCustomerRoute();
    return () => {
      cancelled = true;
    };
  }, [surface, tenantSlug]);

  useEffect(() => {
    let cancelled = false;

    async function loadVehicleRoute() {
      if (surface !== "vehicle" || !tenantSlug) {
        setVehicleRoute(null);
        return;
      }

      try {
        const data = await authFetch<{
          vehicle: {
            driverName?: string | null;
            driverPhone?: string | null;
            routes?: { name?: string | null }[];
          };
        }>(`/t/${tenantSlug}/routes/vehicles/me`);
        if (!cancelled) {
          setVehicleRoute({
            routeName: data.vehicle.routes?.map((route) => route.name).filter(Boolean).join(", ") || "No route assigned",
            driverName: data.vehicle.driverName || "No driver assigned",
            driverPhone: data.vehicle.driverPhone || ""
          });
        }
      } catch {
        if (!cancelled) setVehicleRoute(null);
      }
    }

    loadVehicleRoute();
    return () => {
      cancelled = true;
    };
  }, [surface, tenantSlug]);

  const nav = surface === "customer"
    ? [
        { href: `${routeBase}/customer/cart`, label: "Cart", icon: ShoppingCart },
        { href: `${routeBase}/customer`, label: "Shop", icon: ShoppingBag },
        { href: `${routeBase}/customer/orders`, label: "Orders", icon: ClipboardList },
        { href: `${routeBase}/customer/password`, label: "Password", icon: KeyRound }
      ]
    : surface === "vehicle"
      ? [
        { href: `${routeBase}/vehicle/routes`, label: "Customers", icon: ClipboardList },
        { href: `${routeBase}/vehicle/place-order`, label: "Place Order for Customer", icon: ShoppingCart },
        { href: `${routeBase}/vehicle/bakery-order`, label: "Place Order to Bakery", icon: ShoppingBag },
        { href: `${routeBase}/vehicle/bakery-orders`, label: "Bakery Orders", icon: ClipboardList },
        { href: `${routeBase}/vehicle/truck-loading`, label: "Truck Loading", icon: Truck },
        { href: `${routeBase}/vehicle/route-invoices`, label: "Route Invoices", icon: CreditCard },
        { href: `${routeBase}/vehicle/prices`, label: "Product Prices", icon: IndianRupee },
        { href: `${routeBase}/vehicle/passwords`, label: "Password", icon: KeyRound }
      ]
    : surface === "admin"
      ? [
        { href: "/admin", label: "Overview", icon: Home },
        { href: "/admin/tenants", label: "Bakeries", icon: Building2 },
        { href: "/admin/leads", label: "Bakery Leads", icon: PhoneCall },
        { href: "/admin/postgres-connections", label: "Postgres DBs", icon: Database },
        { href: "/admin/billing", label: "Billing", icon: CreditCard }
      ]
    : bakeryNav.map((item) => ({ ...item, href: `${routeBase}${item.href}` }));

  const isActive = (href: string) => {
    const rootHrefs = new Set(["/admin", `${routeBase}/bakery`, `${routeBase}/customer`, `${routeBase}/vehicle`]);
    if (rootHrefs.has(href)) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const breadcrumbs = useMemo(() => {
    const labels: Record<string, string> = {
      admin: "Platform Admin",
      bakery: surface === "bakery" ? shellTitle : "Bakery CRM",
      customer: surface === "customer" ? shellTitle : "Customer Portal",
      vehicle: surface === "vehicle" ? shellTitle : "Vehicle Workspace",
      tenants: "Bakeries",
      leads: "Bakery Leads",
      "postgres-connections": "Postgres DBs",
      billing: "Billing",
      reports: "Reports",
      orders: "Orders",
      "route-invoices": "Route Invoices",
      "truck-loading": "Truck Loading",
      customers: "Customers",
      categories: "Categories",
      products: "Products",
      prices: "Prices",
      labour: "Labour",
      attendance: "Attendance",
      payments: "Payments",
      inventory: "Inventory",
      expenses: "Expenses",
      sellers: "Sellers",
      routes: "Routes",
      "bakery-order": "Place Order to Bakery",
      "bakery-orders": "Bakery Orders",
      passwords: "Passwords",
      password: "Password",
      profile: "Profile"
    };

    const segments = pathname.split("/").filter(Boolean);
    const visibleSegments =
      segments.length > 1 && (segments[1] === "bakery" || segments[1] === "customer" || segments[1] === "vehicle")
        ? segments.slice(1)
        : segments;
    const hrefBase =
      segments.length > 1 && (segments[1] === "bakery" || segments[1] === "customer" || segments[1] === "vehicle")
        ? `/${segments[0]}`
        : "";

    return visibleSegments.map((segment, index, segments) => ({
        label: labels[segment] || segment,
        href: `${hrefBase}/${segments.slice(0, index + 1).join("/")}`
      }));
  }, [pathname, shellTitle, surface]);

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  const sidebarFooter = surface === "customer" && customerRoute
    ? {
        title: accountSummary?.name || customerRoute.routeName,
        body: [
          accountSummary?.phone || accountSummary?.email || null,
          customerRoute.routeName
        ].filter(Boolean).join(" · ")
      }
    : surface === "vehicle" && vehicleRoute
      ? {
          title: "Vehicle Account",
          body: [accountSummary?.phone || accountSummary?.email || null, vehicleRoute.routeName].filter(Boolean).join(" · ")
        }
    : (surface === "bakery" && accountSummary) || (surface === "customer" && accountSummary) || (surface === "vehicle" && accountSummary)
      ? {
          title: accountSummary.name,
          body: accountSummary.phone || accountSummary.email || "No phone"
        }
    : footerCopy;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function selectSingleZero(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "number" || target.value !== "0" || target.readOnly || target.disabled) return;
      window.requestAnimationFrame(() => target.select());
    }

    document.addEventListener("focusin", selectSingleZero);
    return () => {
      document.removeEventListener("focusin", selectSingleZero);
    };
  }, []);

  if (authState !== "allowed") {
    return (
      <div className="grid min-h-screen place-items-center bg-night px-4 text-ink">
        <PwaRegister />
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full max-w-full overflow-x-hidden bg-night pb-[calc(6rem+env(safe-area-inset-bottom))] text-ink lg:pb-0">
      <PwaRegister />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-sidebar px-4 py-5 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3 rounded-md px-2">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-mint text-lg font-bold text-white">
            BM
          </span>
          <span>
            <span className="block text-lg font-semibold">{shellTitle}</span>
            <span className="block text-xs text-slate-300">{subtitle}</span>
          </span>
        </Link>

        <nav className="mt-8 grid flex-1 auto-rows-max content-start gap-1 overflow-y-auto pr-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white text-sidebar shadow-subtle"
                    : "text-slate-300 hover:bg-sidebar2 hover:text-white"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {surface !== "admin" ? (
          <div className="mt-4 shrink-0 rounded-lg border border-white/10 bg-sidebar2 p-4">
            <p className="text-sm font-semibold">{sidebarFooter.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">{sidebarFooter.body}</p>
          </div>
        ) : null}
      </aside>

      <header className="sticky top-0 z-20 max-w-full border-b border-line bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur lg:ml-72">
        <div className="flex min-h-14 min-w-0 items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line lg:hidden"
              onClick={() => setMenuOpen(true)}
              title="Open menu"
              type="button"
            >
              <Menu size={20} />
            </button>
            <span className="grid h-10 w-10 place-items-center rounded-md bg-mint text-lg font-bold text-white lg:hidden">
              BM
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold sm:text-xl">{shellTitle}</span>
              <span className="block truncate text-xs text-muted sm:hidden">{subtitle}</span>
            </span>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <button className="focus-ring rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-label="Close menu" type="button" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-sidebar px-4 py-5 text-white shadow-subtle">
            <div className="flex items-start justify-between gap-3">
              <Link href="/" className="flex min-w-0 items-center gap-3 rounded-md px-1">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-mint text-lg font-bold text-white">
                  BM
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold">{shellTitle}</span>
                  <span className="block truncate text-xs text-slate-300">{subtitle}</span>
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-sidebar2 px-3 text-xs font-semibold"
                  onClick={handleLogout}
                  title="Sign out"
                  type="button"
                >
                  <LogOut size={18} />
                  <span>Sign out</span>
                </button>
                <button
                  className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-white/10 bg-sidebar2"
                  onClick={() => setMenuOpen(false)}
                  title="Close menu"
                  type="button"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <nav className="mt-7 grid gap-1 overflow-auto pb-4">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`focus-ring flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition ${
                      active
                        ? "bg-white text-sidebar shadow-subtle"
                        : "text-slate-300 hover:bg-sidebar2 hover:text-white"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {surface !== "admin" ? (
              <div className="mt-auto rounded-lg border border-white/10 bg-sidebar2 p-4">
                <p className="text-sm font-semibold">{sidebarFooter.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{sidebarFooter.body}</p>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
      <main className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 max-w-full flex-col overflow-x-hidden bg-night px-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:ml-72 lg:pb-6">
        <nav className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) => {
            const last = index === breadcrumbs.length - 1;
            return (
              <span key={item.href} className="flex items-center gap-2">
                {index > 0 ? <span>/</span> : null}
                {last ? (
                  <span className="font-medium text-ink">{item.label}</span>
                ) : (
                  <Link className="hover:text-mint" href={item.href}>
                    {item.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
        <div className="app-shell-content min-h-0 flex-1">
          {children}
        </div>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-12px_30px_rgba(16,32,51,0.08)] lg:hidden">
        <div className="flex w-full max-w-full gap-1 overflow-x-auto px-2 pt-2 [-webkit-overflow-scrolling:touch]">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`focus-ring flex min-w-[4.8rem] shrink-0 flex-col items-center gap-1 rounded-md px-2 py-2 text-xs ${
                active ? "bg-mint/10 text-mint" : "text-muted"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        </div>
      </nav>
    </div>
  );
}
