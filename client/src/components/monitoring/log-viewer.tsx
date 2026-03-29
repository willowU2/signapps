"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  service: string;
  message: string;
  traceId?: string;
}

const LOG_LEVELS = ["INFO", "WARN", "ERROR"] as const;

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const services = Array.from(
    new Set(logs.map((log) => log.service))
  ) as string[];

  useEffect(() => {
    import("@/lib/api").then(({ alertsApi }) => {
      alertsApi.listHistory(100).then((res) => {
        const events = res.data ?? [];
        const mapped: LogEntry[] = events.map((e) => ({
          timestamp: e.triggered_at,
          level: e.severity === "critical" ? "ERROR" : e.severity === "warning" ? "WARN" : "INFO",
          service: e.metric_type,
          message: e.message,
          traceId: e.id,
        }));
        setLogs(mapped);
      }).catch(() => {
        // No backend logs available — start with empty list
        setLogs([]);
      });
    });
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = logs;

    if (levelFilter !== "all") {
      filtered = filtered.filter((log) => log.level === levelFilter);
    }

    if (serviceFilter !== "all") {
      filtered = filtered.filter((log) => log.service === serviceFilter);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(searchLower) ||
          log.traceId?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, search, levelFilter, serviceFilter]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [filteredLogs, autoScroll]);

  const levelColor = (level: string) => {
    switch (level) {
      case "INFO":
        return "bg-blue-100 text-blue-800";
      case "WARN":
        return "bg-yellow-100 text-yellow-800";
      case "ERROR":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleClear = () => {
    setLogs([]);
    setFilteredLogs([]);
  };

  return (
    <Card className="w-full h-full flex flex-col bg-slate-900 text-gray-100 border-slate-700">
      <div className="p-4 border-b border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Log Viewer</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="border-slate-600 hover:bg-slate-800"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-slate-800 border-slate-600 text-gray-100"
            />
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-32 bg-slate-800 border-slate-600 text-gray-100">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="INFO">INFO</SelectItem>
                <SelectItem value="WARN">WARN</SelectItem>
                <SelectItem value="ERROR">ERROR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-40 bg-slate-800 border-slate-600 text-gray-100">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              <SelectItem value="all">All Services</SelectItem>
              {services.map((service) => (
                <SelectItem key={service} value={service}>
                  {service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-400">Auto-scroll</span>
            <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2 font-mono text-sm">
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No logs matching filters
            </div>
          ) : (
            <>
              {filteredLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 p-2 hover:bg-slate-800 rounded border border-transparent hover:border-slate-700 transition"
                >
                  <Badge className={`${levelColor(log.level)} shrink-0`}>
                    {log.level}
                  </Badge>
                  <span className="text-gray-400 w-32 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-purple-400 w-32 shrink-0">
                    {log.service}
                  </span>
                  <span className="text-gray-300 flex-1">{log.message}</span>
                  {log.traceId && (
                    <span className="text-gray-500 text-xs">{log.traceId}</span>
                  )}
                </div>
              ))}
              <div ref={scrollRef} />
            </>
          )}
        </div>
      </ScrollArea>

      <div className="px-4 py-2 border-t border-slate-700 text-xs text-gray-500">
        Showing {filteredLogs.length} of {logs.length} logs
      </div>
    </Card>
  );
}
