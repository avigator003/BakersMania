"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Clipboard, Database, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { useToast } from "../../../components/toast-provider";
import { apiBaseUrl, getStoredTenantSlug, getStoredToken } from "../../../lib/api";

type TimedCheck<T = unknown> = {
  label: string;
  ok: boolean;
  durationMs: number;
  value?: T;
  error?: string;
};

type Diagnostics = {
  generatedAt: string;
  nodeEnv: string;
  uptimeSeconds: number;
  tenantSlug: string | null;
  checks: {
    dbPing: TimedCheck;
    platformCounts: TimedCheck<{ tenantCount: number; orderCount: number; customerCount: number }>;
    tenant: {
      lookup: TimedCheck<{ id: string; name: string; slug: string; status: string } | null>;
      counts?: TimedCheck<{
        customerCount: number;
        orderCount: number;
        productCount: number;
        routeCount: number;
        vehicleCount: number;
        expenseCount: number;
      }>;
    } | null;
  };
};

type BrowserMetric = {
  label: string;
  path: string;
  status: number | "ERR";
  ok: boolean;
  durationMs: number;
  bytes: number;
  error?: string;
};

type RequestMetric = {
  id: string;
  at: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  contentLength: number | null;
  tenantSlug: string | null;
  actorType: string | null;
  routeGroup: string;
  requestId: string | null;
};

function badgeClass(ok: boolean) {
  return ok ? "border-mint/30 bg-mint/10 text-mint" : "border-berry/30 bg-berry/10 text-berry";
}

function formatBytes(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes > 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function CheckRow({ check }: { check: TimedCheck }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold">{check.label}</p>
        {check.error ? <p className="mt-1 text-xs text-berry">{check.error}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${badgeClass(check.ok)}`}>{check.ok ? "OK" : "Failed"}</span>
        <span className="rounded-md border border-line bg-panel2 px-2 py-1 font-semibold">{check.durationMs} ms</span>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const toast = useToast();
  const [tenantSlug, setTenantSlug] = useState(() => (typeof window === "undefined" ? "star-bakery" : getStoredTenantSlug() || "star-bakery"));
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [browserMetrics, setBrowserMetrics] = useState<BrowserMetric[]>([]);
  const [requestMetrics, setRequestMetrics] = useState<RequestMetric[]>([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [loadingBrowser, setLoadingBrowser] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const copyText = useMemo(() => {
    const lines = [
      `API: ${apiBaseUrl}`,
      `Tenant: ${tenantSlug}`,
      diagnostics ? `Server generated: ${diagnostics.generatedAt}` : "",
      diagnostics ? `DB ping: ${diagnostics.checks.dbPing.durationMs}ms ${diagnostics.checks.dbPing.ok ? "OK" : "FAILED"}` : "",
      diagnostics ? `Platform counts: ${diagnostics.checks.platformCounts.durationMs}ms` : "",
      diagnostics?.checks.tenant?.lookup ? `Tenant lookup: ${diagnostics.checks.tenant.lookup.durationMs}ms ${diagnostics.checks.tenant.lookup.ok ? "OK" : "FAILED"}` : "",
      diagnostics?.checks.tenant?.counts ? `Tenant counts: ${diagnostics.checks.tenant.counts.durationMs}ms` : "",
      ...browserMetrics.map((metric) => `${metric.label}: ${metric.durationMs}ms status=${metric.status} bytes=${metric.bytes}`),
      requestMetrics.length ? "Recent API requests:" : "",
      ...requestMetrics.slice(0, 20).map((metric) =>
        `${metric.at} ${metric.method} ${metric.path} ${metric.statusCode} ${metric.durationMs}ms bytes=${metric.contentLength ?? "unknown"} tenant=${metric.tenantSlug || "-"} actor=${metric.actorType || "-"}`
      )
    ].filter(Boolean);
    return lines.join("\n");
  }, [browserMetrics, diagnostics, requestMetrics, tenantSlug]);

  useEffect(() => {
    loadRequestMetrics({ quiet: true });
  }, []);

  async function loadServerDiagnostics() {
    setLoadingServer(true);
    try {
      const token = getStoredToken();
      const response = await fetch(`${apiBaseUrl}/platform-admin/diagnostics?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });
      if (!response.ok) throw new Error(`Diagnostics failed: ${response.status}`);
      setDiagnostics((await response.json()) as Diagnostics);
      toast.success("Server diagnostics loaded", "DB and API timings are ready.");
    } catch (error) {
      toast.error("Diagnostics failed", error instanceof Error ? error.message : "Could not load diagnostics.");
    } finally {
      setLoadingServer(false);
    }
  }

  async function timedFetch(label: string, path: string): Promise<BrowserMetric> {
    const token = getStoredToken();
    const start = performance.now();
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });
      const text = await response.text();
      return {
        label,
        path,
        status: response.status,
        ok: response.ok,
        durationMs: Math.round(performance.now() - start),
        bytes: new Blob([text]).size,
        error: response.ok ? undefined : text.slice(0, 180)
      };
    } catch (error) {
      return {
        label,
        path,
        status: "ERR",
        ok: false,
        durationMs: Math.round(performance.now() - start),
        bytes: 0,
        error: error instanceof Error ? error.message : "Request failed"
      };
    }
  }

  async function runBrowserMetrics() {
    setLoadingBrowser(true);
    try {
      const paths: Array<[string, string]> = [
        ["Health", "/health"],
        ["Server diagnostics", `/platform-admin/diagnostics?tenantSlug=${encodeURIComponent(tenantSlug)}`],
        ["Customers", `/t/${tenantSlug}/customers`],
        ["Products", `/t/${tenantSlug}/catalog/products`],
        ["Orders", `/t/${tenantSlug}/orders`]
      ];
      const results = [];
      for (const [label, path] of paths) {
        results.push(await timedFetch(label, path));
      }
      setBrowserMetrics(results);
      toast.success("Browser metrics loaded", "Endpoint timing and payload sizes are ready.");
    } catch (error) {
      toast.error("Browser metrics failed", error instanceof Error ? error.message : "Could not run endpoint checks.");
    } finally {
      setLoadingBrowser(false);
    }
  }

  async function loadRequestMetrics(options?: { quiet?: boolean }) {
    setLoadingRequests(true);
    try {
      const token = getStoredToken();
      const response = await fetch(`${apiBaseUrl}/platform-admin/request-metrics?limit=80`, {
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      });
      if (!response.ok) throw new Error(`Metrics failed: ${response.status}`);
      const data = (await response.json()) as { metrics: RequestMetric[] };
      setRequestMetrics(data.metrics || []);
      if (!options?.quiet) toast.success("Request metrics loaded", "Recent API calls are visible below.");
    } catch (error) {
      if (!options?.quiet) toast.error("Request metrics failed", error instanceof Error ? error.message : "Could not load request metrics.");
    } finally {
      setLoadingRequests(false);
    }
  }

  async function copyMetrics() {
    await navigator.clipboard.writeText(copyText);
    toast.success("Copied metrics", "Paste this to me and I can read the timing story.");
  }

  return (
    <AppShell title="Platform Admin" subtitle="Production diagnostics and endpoint timings" surface="admin">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-4 border-b border-line p-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-mint">Diagnostics</p>
              <h1 className="mt-1 text-xl font-semibold">API, DB, and page-load metrics</h1>
              <p className="mt-1 text-sm text-muted">Run this in production, then copy the results for debugging.</p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <label className="grid gap-1 text-sm font-semibold">
                Tenant slug
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setTenantSlug(event.target.value.trim())} value={tenantSlug} />
              </label>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" disabled={loadingServer || !tenantSlug} onClick={loadServerDiagnostics} type="button">
                <Database size={16} />
                {loadingServer ? "Checking..." : "Server Check"}
              </button>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" disabled={loadingBrowser || !tenantSlug} onClick={runBrowserMetrics} type="button">
                <Activity size={16} />
                {loadingBrowser ? "Measuring..." : "Browser Check"}
              </button>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" disabled={loadingRequests} onClick={() => loadRequestMetrics()} type="button">
                <RefreshCw size={16} />
                {loadingRequests ? "Loading..." : "Recent Requests"}
              </button>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" disabled={!copyText} onClick={copyMetrics} type="button">
                <Clipboard size={16} />
                Copy
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4 xl:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel2 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Server Metrics</h2>
                <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel" disabled={loadingServer} onClick={loadServerDiagnostics} title="Refresh server metrics" type="button"><RefreshCw size={15} /></button>
              </div>
              {diagnostics ? (
                <div className="mt-3 text-sm">
                  <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-muted">
                    <span>Generated: <span className="font-semibold text-ink">{new Date(diagnostics.generatedAt).toLocaleString()}</span></span>
                    <span>Env: <span className="font-semibold text-ink">{diagnostics.nodeEnv}</span></span>
                    <span>Uptime: <span className="font-semibold text-ink">{diagnostics.uptimeSeconds}s</span></span>
                  </div>
                  <CheckRow check={diagnostics.checks.dbPing} />
                  <CheckRow check={diagnostics.checks.platformCounts} />
                  {diagnostics.checks.tenant?.lookup ? <CheckRow check={diagnostics.checks.tenant.lookup} /> : null}
                  {diagnostics.checks.tenant?.counts ? <CheckRow check={diagnostics.checks.tenant.counts} /> : null}
                  {diagnostics.checks.tenant?.counts?.value ? (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
                      {Object.entries(diagnostics.checks.tenant.counts.value).map(([label, value]) => (
                        <span key={label}>{label}: <span className="font-semibold text-ink">{value}</span></span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">Run Server Check to measure Render-to-Neon timing.</p>
              )}
            </div>

            <div className="rounded-lg border border-line bg-panel2 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Browser Metrics</h2>
                <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel" disabled={loadingBrowser} onClick={runBrowserMetrics} title="Refresh browser metrics" type="button"><RefreshCw size={15} /></button>
              </div>
              {browserMetrics.length ? (
                <div className="mt-3 divide-y divide-line text-sm">
                  {browserMetrics.map((metric) => (
                    <div className="grid gap-2 py-3" key={metric.path}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold">{metric.label}</p>
                          <p className="truncate text-xs text-muted">{metric.path}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${badgeClass(metric.ok)}`}>{metric.status}</span>
                          <span className="rounded-md border border-line bg-panel px-2 py-1 font-semibold">{metric.durationMs} ms</span>
                          <span className="rounded-md border border-line bg-panel px-2 py-1 font-semibold">{formatBytes(metric.bytes)}</span>
                        </div>
                      </div>
                      {metric.error ? <p className="text-xs text-berry">{metric.error}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">Run Browser Check to measure real endpoint timing and payload sizes from this page.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Recent API Requests</h2>
              <p className="mt-1 text-sm text-muted">Open any bakery page, then refresh this list to see the exact production API timings.</p>
            </div>
            <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" disabled={loadingRequests} onClick={() => loadRequestMetrics()} type="button">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          {requestMetrics.length ? (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="sticky top-0 border-b border-line bg-panel2 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Request</th>
                    <th className="px-4 py-3">Group</th>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3 text-right">Status</th>
                    <th className="px-4 py-3 text-right">Time</th>
                    <th className="px-4 py-3 text-right">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {requestMetrics.map((metric) => (
                    <tr key={metric.id} className={metric.durationMs > 2000 ? "bg-berry/5" : ""}>
                      <td className="px-4 py-3 text-muted">{new Date(metric.at).toLocaleTimeString()}</td>
                      <td className="px-4 py-3">
                        <span className="block font-semibold">{metric.method} {metric.path}</span>
                        <span className="text-xs text-muted">{metric.requestId || "No request id"}</span>
                      </td>
                      <td className="px-4 py-3">{metric.routeGroup}</td>
                      <td className="px-4 py-3">{metric.tenantSlug || "-"}</td>
                      <td className="px-4 py-3">{metric.actorType || "-"}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${metric.statusCode >= 400 ? "text-berry" : "text-mint"}`}>{metric.statusCode}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${metric.durationMs > 2000 ? "text-berry" : ""}`}>{metric.durationMs} ms</td>
                      <td className="px-4 py-3 text-right">{metric.contentLength === null ? "-" : formatBytes(metric.contentLength)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-4 text-sm text-muted">No request metrics yet. Open a bakery page, then come back and refresh.</p>
          )}
        </section>

        <section className="rounded-lg border border-line bg-panel p-4 shadow-subtle">
          <h2 className="font-semibold">What To Send Me</h2>
          <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-night p-3 text-xs text-white">{copyText || "Run both checks, then copy the metrics here."}</pre>
        </section>
      </div>
    </AppShell>
  );
}
