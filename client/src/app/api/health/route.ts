import { NextResponse } from "next/server";

/**
 * /api/health — Platform health check endpoint
 *
 * Returns the status of all backend services.
 * Each service is probed with a 2-second timeout.
 * This route is unauthenticated so monitoring tools can poll it.
 */

interface ServiceDef {
  name: string;
  url: string;
}

const SERVICES: ServiceDef[] = [
  { name: "identity", url: "http://localhost:3001/health" },
  { name: "containers", url: "http://localhost:3002/health" },
  { name: "proxy", url: "http://localhost:3003/health" },
  { name: "storage", url: "http://localhost:3004/health" },
  { name: "ai", url: "http://localhost:3005/health" },
  { name: "securelink", url: "http://localhost:3006/health" },
  { name: "scheduler", url: "http://localhost:3007/health" },
  { name: "metrics", url: "http://localhost:3008/health" },
  { name: "media", url: "http://localhost:3009/health" },
  { name: "docs", url: "http://localhost:3010/health" },
  { name: "calendar", url: "http://localhost:3011/health" },
  { name: "mail", url: "http://localhost:3012/health" },
  { name: "collab", url: "http://localhost:3013/health" },
  { name: "meet", url: "http://localhost:3014/health" },
  { name: "chat", url: "http://localhost:3020/health" },
  { name: "social", url: "http://localhost:3019/health" },
];

interface ServiceResult {
  name: string;
  status: "up" | "down";
  latencyMs?: number;
  error?: string;
}

export async function GET() {
  const start = Date.now();

  const results = await Promise.allSettled(
    SERVICES.map(async (svc): Promise<ServiceResult> => {
      const t0 = Date.now();
      try {
        const res = await fetch(svc.url, {
          signal: AbortSignal.timeout(2000),
          cache: "no-store",
        });
        const latencyMs = Date.now() - t0;
        return {
          name: svc.name,
          status: res.ok ? "up" : "down",
          latencyMs,
        };
      } catch (err) {
        const latencyMs = Date.now() - t0;
        return {
          name: svc.name,
          status: "down",
          latencyMs,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }),
  );

  const services: ServiceResult[] = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          name: SERVICES[i].name,
          status: "down" as const,
          error: "Promise rejected",
        },
  );

  const upCount = services.filter((s) => s.status === "up").length;
  const totalMs = Date.now() - start;

  return NextResponse.json(
    {
      status: "ok",
      services,
      summary: {
        total: services.length,
        up: upCount,
        down: services.length - upCount,
        checkDurationMs: totalMs,
      },
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
