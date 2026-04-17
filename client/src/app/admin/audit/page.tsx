"use client";

import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Download, RefreshCw, Trash2, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { LoadingState } from "@/components/ui/loading-state";
import { DateDisplay } from "@/components/ui/date-display";
import { auditApi } from "@/lib/api/crosslinks";
import type { AuditLogEntry as ApiAuditLogEntry } from "@/types/crosslinks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: "login" | "logout" | "create" | "edit" | "delete" | "settings_change";
  target: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "signapps_audit_log";

const ACTION_LABELS: Record<AuditEntry["action"], string> = {
  login: "Connexion",
  logout: "Deconnexion",
  create: "Creation",
  edit: "Modification",
  delete: "Suppression",
  settings_change: "Parametre modifie",
};

const ACTION_COLORS: Record<AuditEntry["action"], string> = {
  login: "bg-purple-500/10 text-purple-600",
  logout: "bg-gray-500/10 text-muted-foreground",
  create: "bg-green-500/10 text-green-600",
  edit: "bg-blue-500/10 text-blue-600",
  delete: "bg-red-500/10 text-red-600",
  settings_change: "bg-yellow-500/10 text-yellow-700",
};

const ALL_ACTIONS: AuditEntry["action"][] = [
  "login",
  "logout",
  "create",
  "edit",
  "delete",
  "settings_change",
];

// ---------------------------------------------------------------------------
// (No sample data — all entries come from the audit API)
// ---------------------------------------------------------------------------

/** Map an API AuditLogEntry to the local AuditEntry shape for display */
function normalizeApiEntry(e: ApiAuditLogEntry): AuditEntry {
  // Best-effort mapping of API action to local action enum
  const actionMap: Record<string, AuditEntry["action"]> = {
    create: "create",
    update: "edit",
    edit: "edit",
    delete: "delete",
    login: "login",
    logout: "logout",
    settings_change: "settings_change",
    settings: "settings_change",
  };
  const rawAction = (e.action ?? "").toLowerCase();
  const action: AuditEntry["action"] = actionMap[rawAction] ?? "edit";

  const actor =
    e.actor_id ?? (e.metadata?.actor_email as string | undefined) ?? "system";
  const target = e.entity_type + (e.entity_id ? `:${e.entity_id}` : "");
  const details = e.actor_ip ? `IP ${e.actor_ip}` : undefined;

  return {
    id: e.id,
    timestamp: e.created_at,
    user: actor,
    action,
    target,
    details,
  };
}

function loadLocalCache(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuditEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Corrupted — ignore
  }
  return [];
}

function saveEntries(entries: AuditEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditLogPage() {
  usePageTitle("Audit");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await auditApi.query({ limit: 200 });
      const normalized = res.data.map(normalizeApiEntry);
      if (normalized.length > 0) {
        setEntries(normalized);
        saveEntries(normalized);
      } else {
        // API returned empty — try cached data from previous fetch
        setEntries(loadLocalCache());
      }
    } catch {
      // API unavailable — try cached data from previous fetch
      setEntries(loadLocalCache());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries().finally(() => setInitialLoading(false));
  }, []);

  // Derived filtered list
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Action filter
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      // Date range
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        if (new Date(e.timestamp).getTime() < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo).getTime() + 86_400_000; // end of day
        if (new Date(e.timestamp).getTime() > to) return false;
      }
      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.user.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.target.toLowerCase().includes(q) ||
          (e.details || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [entries, search, actionFilter, dateFrom, dateTo]);

  const refresh = async () => {
    await fetchEntries();
    toast.success("Journal d'audit rechargé");
  };

  const clearFilters = () => {
    setSearch("");
    setActionFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Timestamp", "User", "Action", "Target", "Details"];
    const rows = filtered.map((e) =>
      [e.timestamp, e.user, e.action, e.target, e.details || ""]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} entries exported (CSV)`);
  };

  const exportJson = () => {
    if (filtered.length === 0) return;
    const payload = {
      export_time: new Date().toISOString(),
      total: filtered.length,
      format_version: "1.0",
      entries: filtered,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} entries exported (JSON)`);
  };

  const clearAuditLog = () => {
    saveEntries([]);
    setEntries([]);
    toast.success("Journal d'audit réinitialisé");
  };

  const hasFilters = search || actionFilter !== "all" || dateFrom || dateTo;

  if (initialLoading) {
    return (
      <AppLayout>
        <div className="w-full space-y-6">
          <PageHeader
            title="Journal d'audit"
            description="Toutes les actions utilisateur — connexions, modifications, suppressions"
            icon={<Shield className="h-5 w-5" />}
          />
          <LoadingState variant="skeleton" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <PageHeader
          title="Journal d'audit"
          description="Toutes les actions utilisateur — connexions, modifications, suppressions"
          icon={<Shield className="h-5 w-5" />}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="h-4 w-4" />
                Rafraîchir
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportJson}>
                <Download className="h-4 w-4" />
                JSON
              </Button>
              <Button variant="outline" size="sm" onClick={clearAuditLog}>
                <Trash2 className="h-4 w-4" />
                Reset
              </Button>
            </>
          }
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Text search */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Recherche
                </label>
                <SearchInput
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Utilisateur, action, cible..."
                />
              </div>

              {/* Action filter */}
              <div className="w-[180px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Type d&apos;action
                </label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les actions</SelectItem>
                    {ALL_ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ACTION_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date from */}
              <div className="w-[160px]">
                <label
                  htmlFor="audit-date-from"
                  className="text-xs font-medium text-muted-foreground mb-1 block"
                >
                  Du
                </label>
                <Input
                  id="audit-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* Date to */}
              <div className="w-[160px]">
                <label
                  htmlFor="audit-date-to"
                  className="text-xs font-medium text-muted-foreground mb-1 block"
                >
                  Au
                </label>
                <Input
                  id="audit-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              {/* Clear filters */}
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <Filter className="h-4 w-4 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {loading
              ? "Chargement..."
              : `${filtered.length} / ${entries.length} entrees`}
          </Badge>
          {hasFilters && !loading && (
            <span className="text-xs text-muted-foreground">
              Filtres actifs
            </span>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[62vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">
                      Horodatage
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium">
                      Utilisateur
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium">
                      Action
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium">Cible</th>
                    <th className="text-left px-4 py-2.5 font-medium">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      className="h-12 hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        <DateDisplay date={e.timestamp} withTime />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{e.user}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[e.action] || "bg-muted text-muted-foreground"}`}
                        >
                          {ACTION_LABELS[e.action]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">{e.target}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground max-w-[300px] truncate">
                        {e.details || "---"}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        Aucune entree correspondant aux filtres
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
