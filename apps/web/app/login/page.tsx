"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Lock, Mail } from "lucide-react";
import { apiFetch, storeSession } from "../../lib/api";

type LoginResponse = {
  token: string;
  actorType: "platform_admin" | "bakery_user" | "customer" | "vehicle";
  tenantSlug?: string;
  role?: string;
};

function desiredActorFromPath(path: string) {
  if (path.startsWith("/admin")) return "platform_admin";
  if (path.startsWith("/bakery") || path.includes("/bakery")) return "bakery_user";
  if (path.startsWith("/customer") || path.includes("/customer")) return "customer";
  if (path.startsWith("/vehicle") || path.includes("/vehicle")) return "vehicle";
  return undefined;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ email, password, desiredActor: desiredActorFromPath(nextPath) })
      });
      storeSession(session);
      const tenantBase = session.tenantSlug ? `/${session.tenantSlug}` : "";
      const fallback =
        session.actorType === "platform_admin"
          ? "/admin"
            : session.actorType === "customer"
              ? `${tenantBase}/customer`
              : session.actorType === "vehicle"
                ? `${tenantBase}/vehicle`
            : `${tenantBase}/bakery`;
      const nextAllowed =
        (session.actorType === "platform_admin" && nextPath.startsWith("/admin")) ||
        (session.actorType === "bakery_user" && (nextPath.startsWith("/bakery") || Boolean(session.tenantSlug && nextPath.startsWith(`/${session.tenantSlug}/bakery`)))) ||
        (session.actorType === "customer" && (nextPath.startsWith("/customer") || Boolean(session.tenantSlug && nextPath.startsWith(`/${session.tenantSlug}/customer`)))) ||
        (session.actorType === "vehicle" && (nextPath.startsWith("/vehicle") || Boolean(session.tenantSlug && nextPath.startsWith(`/${session.tenantSlug}/vehicle`))));
      router.push(nextAllowed ? nextPath : fallback);
    } catch {
      setError("Login failed. Check API is running and credentials are correct.");
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
            <span className="block text-sm text-muted">Platform, bakery, customer, and vehicle access</span>
          </span>
        </Link>

        <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Email or phone</span>
            <span className="flex items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Mail size={18} />
              <input
                className="w-full border-0 bg-transparent outline-none"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com or vehicle phone"
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
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
