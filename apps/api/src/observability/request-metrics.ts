import type { RequestHandler } from "express";
import { performance } from "node:perf_hooks";

export type RequestMetric = {
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

const MAX_METRICS = 250;
const metrics: RequestMetric[] = [];

function routeGroup(path: string) {
  if (path === "/health") return "health";
  if (path.startsWith("/platform-admin")) return "platform-admin";
  const tenantMatch = path.match(/^\/t\/[^/]+\/([^/?]+)/);
  if (tenantMatch?.[1]) return tenantMatch[1];
  const rootMatch = path.match(/^\/([^/?]+)/);
  return rootMatch?.[1] || "root";
}

function tenantSlugFromPath(path: string) {
  return path.match(/^\/t\/([^/?]+)/)?.[1] || null;
}

export const requestMetricsMiddleware: RequestHandler = (req, res, next) => {
  const start = performance.now();

  res.on("finish", () => {
    const path = req.originalUrl.split("?")[0] || req.originalUrl;
    if (path.startsWith("/platform-admin/request-metrics")) return;

    const contentLengthHeader = res.getHeader("content-length");
    const contentLength = typeof contentLengthHeader === "number"
      ? contentLengthHeader
      : typeof contentLengthHeader === "string"
        ? Number(contentLengthHeader)
        : null;

    metrics.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs: Math.round(performance.now() - start),
      contentLength: Number.isFinite(contentLength) ? contentLength : null,
      tenantSlug: req.tenant?.slug || tenantSlugFromPath(path),
      actorType: req.auth?.actorType || null,
      routeGroup: routeGroup(path),
      requestId: req.requestId || null
    });

    if (metrics.length > MAX_METRICS) {
      metrics.length = MAX_METRICS;
    }
  });

  next();
};

export function getRecentRequestMetrics(limit = 100) {
  return metrics.slice(0, Math.min(Math.max(limit, 1), MAX_METRICS));
}
