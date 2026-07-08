"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Lock, Mail } from "lucide-react";
import { apiFetch, storeSession } from "../../lib/api";

type ActorType = "platform_admin" | "bakery_user" | "customer" | "vehicle";

type LoginResponse = {
  token: string;
  actorType: ActorType;
  tenantSlug?: string;
  role?: string;
};

type LoginFormProps = {
  forcedActor?: ActorType;
};

const actorLabels: Record<ActorType, string> = {
  platform_admin: "Admin",
  bakery_user: "Bakery",
  customer: "Customer",
  vehicle: "Vehicle"
};

function desiredActorFromPath(path: string) {
  if (path.startsWith("/admin")) return "platform_admin";
  if (path.startsWith("/bakery") || path.includes("/bakery")) return "bakery_user";
  if (path.startsWith("/customer") || path.includes("/customer")) return "customer";
  if (path.startsWith("/vehicle") || path.includes("/vehicle")) return "vehicle";
  return undefined;
}

function fallbackPath(session: LoginResponse) {
  const tenantBase = session.tenantSlug ? `/${session.tenantSlug}` : "";
  if (session.actorType === "platform_admin") return "/admin";
  if (session.actorType === "customer") return `${tenantBase}/customer`;
  if (session.actorType === "vehicle") return `${tenantBase}/vehicle`;
  return `${tenantBase}/bakery`;
}

function nextPathAllowed(session: LoginResponse, nextPath: string) {
  if (!nextPath) return false;
  return (
    (session.actorType === "platform_admin" && nextPath.startsWith("/admin")) ||
    (session.actorType === "bakery_user" && (nextPath.startsWith("/bakery") || Boolean(session.tenantSlug && nextPath.startsWith(`/${session.tenantSlug}/bakery`)))) ||
    (session.actorType === "customer" && (nextPath.startsWith("/customer") || Boolean(session.tenantSlug && nextPath.startsWith(`/${session.tenantSlug}/customer`)))) ||
    (session.actorType === "vehicle" && (nextPath.startsWith("/vehicle") || Boolean(session.tenantSlug && nextPath.startsWith(`/${session.tenantSlug}/vehicle`))))
  );
}

export function LoginForm({ forcedActor }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const desiredActor = forcedActor || desiredActorFromPath(nextPath);

  useEffect(() => {
    setNextPath(new URLSearchParams(window.location.search).get("next") || "");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, desiredActor })
      });
      storeSession(session);
      router.push(nextPathAllowed(session, nextPath) ? nextPath : fallbackPath(session));
    } catch {
      setError("Login failed. Check credentials and portal type.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-night px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-line bg-panel p-6 shadow-subtle">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-mint font-bold text-white">BM</span>
          <span>
            <span className="block text-xl font-semibold">BakersMania</span>
            <span className="block text-sm text-muted">{forcedActor ? `${actorLabels[forcedActor]} login` : "Choose the correct portal for shared phone numbers"}</span>
          </span>
        </Link>

        <div className="mt-6 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Link className={`focus-ring rounded-md border px-3 py-2 text-center font-semibold ${forcedActor === "bakery_user" ? "border-mint bg-mint text-white" : "border-line bg-panel2"}`} href="/login/bakery">Bakery</Link>
          <Link className={`focus-ring rounded-md border px-3 py-2 text-center font-semibold ${forcedActor === "vehicle" ? "border-mint bg-mint text-white" : "border-line bg-panel2"}`} href="/login/vehicle">Vehicle</Link>
          <Link className={`focus-ring rounded-md border px-3 py-2 text-center font-semibold ${forcedActor === "customer" ? "border-mint bg-mint text-white" : "border-line bg-panel2"}`} href="/login/customer">Customer</Link>
          <Link className={`focus-ring rounded-md border px-3 py-2 text-center font-semibold ${forcedActor === "platform_admin" ? "border-mint bg-mint text-white" : "border-line bg-panel2"}`} href="/login/admin">Admin</Link>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Email or phone</span>
            <span className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Mail size={18} />
              <input
                className="w-full border-0 bg-transparent outline-none"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email or phone"
                type="text"
                value={email}
              />
            </span>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Password</span>
            <span className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Lock size={18} />
              <input
                className="w-full border-0 bg-transparent outline-none"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                type="password"
                value={password}
              />
            </span>
          </label>
          {error ? <p className="rounded-md bg-berry/10 px-3 py-2 text-sm text-berry">{error}</p> : null}
          <button className="focus-ring rounded-md bg-mint px-4 py-3 font-semibold text-white" disabled={loading}>
            {loading ? "Signing in..." : `Sign in${forcedActor ? ` as ${actorLabels[forcedActor]}` : ""}`}
          </button>
        </form>
      </section>
    </main>
  );
}
