"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, AlertCircle, CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

interface ServiceDef {
  name: string;
  port: number;
  healthPath?: string;
}

interface ServiceStatus extends ServiceDef {
  isHealthy: boolean | null;
  latencyMs: number | null;
  lastCheck: Date;
}

const SERVICES: ServiceDef[] = [
  { name: "Identity", port: 3001 },
  { name: "Containers", port: 3002 },
  { name: "Proxy", port: 3003 },
  { name: "Storage", port: 3004 },
  { name: "AI", port: 3005 },
  { name: "SecureLink", port: 3006 },
  { name: "Scheduler", port: 3007 },
  { name: "Metrics", port: 3008 },
  { name: "Media", port: 3009 },
  { name: "Docs", port: 3010 },
  { name: "Calendar", port: 3011 },
  { name: "Mail", port: 3012 },
  { name: "Collab", port: 3013 },
  { name: "Meet", port: 3014 },
  { name: "Forms", port: 3015 },
  { name: "Office", port: 3018 },
  { name: "Chat", port: 3020 },
  { name: "Contacts", port: 3021 },
];

async function checkService(svc: ServiceDef): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    await axios.get(`http://localhost:${svc.port}/health`, {
      timeout: 3000,
      withCredentials: false,
    });
    const latencyMs = Math.round(performance.now() - start);
    return { ...svc, isHealthy: true, latencyMs, lastCheck: new Date() };
  } catch {
    return { ...svc, isHealthy: false, latencyMs: null, lastCheck: new Date() };
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LatencyBadge({ ms }: { ms: number | null }) {
  if (ms === null) return null;
  const color = ms < 50 ? "text-green-600" : ms < 200 ? "text-yellow-600" : "text-red-600";
  return <span className={`text-xs font-mono ${color}`}>{ms}ms</span>;
}

export function HealthDashboard() {
  const [statuses, setStatuses] = useState<ServiceStatus[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const results = await Promise.all(SERVICES.map(checkService));
      setStatuses(results);
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const healthyCount = statuses.filter((s) => s.isHealthy === true).length;
  const unhealthyCount = statuses.filter((s) => s.isHealthy === false).length;
  const unknownCount = statuses.filter((s) => s.isHealthy === null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold">Services Health</h2>
            {lastRefresh && (
              <p className="text-xs text-gray-400">Last checked: {formatTime(lastRefresh)}</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
          className="gap-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary row */}
      {statuses.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{healthyCount}</p>
            <p className="text-xs text-green-600">Healthy</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{unhealthyCount}</p>
            <p className="text-xs text-red-600">Down</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
            <p className="text-2xl font-bold text-gray-500">{unknownCount}</p>
            <p className="text-xs text-gray-400">Unknown</p>
          </div>
        </div>
      )}

      {/* Loading state on first load */}
      {statuses.length === 0 && isRefreshing && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map((svc) => (
          <div
            key={svc.port}
            className={`rounded-lg border p-4 shadow-sm transition-all ${
              svc.isHealthy === true
                ? "border-green-200 bg-white"
                : svc.isHealthy === false
                ? "border-red-200 bg-red-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{svc.name}</h3>
                <p className="text-sm text-gray-400 font-mono">:{svc.port}</p>
              </div>
              <div>
                {svc.isHealthy === null ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                ) : svc.isHealthy ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span
                className={`text-xs font-medium ${
                  svc.isHealthy === true
                    ? "text-green-600"
                    : svc.isHealthy === false
                    ? "text-red-600"
                    : "text-gray-400"
                }`}
              >
                {svc.isHealthy === true ? "Healthy" : svc.isHealthy === false ? "Unreachable" : "Checking…"}
              </span>
              <LatencyBadge ms={svc.latencyMs} />
            </div>

            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-400">
                {svc.lastCheck ? formatTime(svc.lastCheck) : "—"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
