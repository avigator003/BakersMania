const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "https://bakersmania-1.onrender.com";

export const apiBaseUrl = configuredApiBaseUrl.includes("bakery-fhet.onrender.com")
  ? "https://bakersmania-1.onrender.com"
  : configuredApiBaseUrl;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("bakersmania_token");
}

export function getStoredActorType() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("bakersmania_actor_type");
}

export function getStoredTenantSlug() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("bakersmania_tenant_slug");
}

export function getStoredTenantName() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("bakersmania_tenant_name");
}

export function storeTenantName(tenantName: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("bakersmania_tenant_name", tenantName);
}

export function storeSession(session: { token: string; actorType: string; tenantSlug?: string; tenantName?: string; role?: string }) {
  window.localStorage.setItem("bakersmania_token", session.token);
  window.localStorage.setItem("bakersmania_actor_type", session.actorType);
  if (session.tenantSlug) window.localStorage.setItem("bakersmania_tenant_slug", session.tenantSlug);
  if (session.tenantName) window.localStorage.setItem("bakersmania_tenant_name", session.tenantName);
  if (session.role) window.localStorage.setItem("bakersmania_role", session.role);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("bakersmania_token");
  window.localStorage.removeItem("bakersmania_actor_type");
  window.localStorage.removeItem("bakersmania_tenant_slug");
  window.localStorage.removeItem("bakersmania_tenant_name");
  window.localStorage.removeItem("bakersmania_role");
}

export async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  return apiFetch<T>(path, {
    ...init,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  });
}
