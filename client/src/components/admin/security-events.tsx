"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, RefreshCw, AlertTriangle, Info, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { IDENTITY_URL } from "@/lib/api/core";
import axios from "axios";
import { toast } from "sonner";

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: "info" | "warning" | "critical";
  actor_id: string | null;
  ip_address: string | null;
  resource: string | null;
  details: string;
  created_at: string;
}

interface EventSummary {
  event_type: string;
  severity: string;
  count: number;
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  info: { color: "bg-blue-100 text-blue-800", icon: <Info className="h-3.5 w-3.5" /> },
  warning: { color: "bg-yellow-100 text-yellow-800", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  critical: { color: "bg-red-100 text-red-800", icon: <Shield className="h-3.5 w-3.5" /> },
};

function formatEventType(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const PAGE_SIZE = 25;

export function SecurityEvents() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [summary, setSummary] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filterSeverity !== "all") params.set("severity", filterSeverity);
      if (filterType !== "all") params.set("event_type", filterType);

      const [eventsRes, summaryRes] = await Promise.all([
        axios.get(`${IDENTITY_URL}/admin/security/events?${params}`, { withCredentials: true }),
        axios.get(`${IDENTITY_URL}/admin/security/events/summary`, { withCredentials: true }),
      ]);
      setEvents(eventsRes.data);
      setSummary(summaryRes.data);
    } catch {
      toast.error("Impossible de charger les événements de sécurité");
    } finally {
      setIsLoading(false);
    }
  }, [filterSeverity, filterType, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const criticalCount = summary.filter((s) => s.severity === "critical").reduce((a, s) => a + s.count, 0);
  const warningCount = summary.filter((s) => s.severity === "warning").reduce((a, s) => a + s.count, 0);

  const uniqueTypes = Array.from(new Set(summary.map((s) => s.event_type)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-red-600" />
          <div>
            <h2 className="text-xl font-bold">Security Events</h2>
            <p className="text-sm text-gray-500">Last 24 hours activity</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-700">Critical (24h)</p>
            <p className="mt-1 text-2xl font-bold text-red-800">{criticalCount}</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-xs font-medium text-yellow-700">Warnings (24h)</p>
            <p className="mt-1 text-2xl font-bold text-yellow-800">{warningCount}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-blue-700">Event Types</p>
            <p className="mt-1 text-2xl font-bold text-blue-800">{uniqueTypes.length}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterSeverity} onValueChange={(v) => { setFilterSeverity(v); setPage(0); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {uniqueTypes.map((t) => (
              <SelectItem key={t} value={t}>{formatEventType(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
          No events found
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">IP Address</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Details</th>
                <th className="px-4 py-3 text-left">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => {
                const sev = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info;
                return (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sev.color}`}>
                        {sev.icon}
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatEventType(event.event_type)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell font-mono text-xs">
                      {event.ip_address || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell max-w-xs truncate">
                      {event.details}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(event.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {events.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page + 1}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={events.length < PAGE_SIZE}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
