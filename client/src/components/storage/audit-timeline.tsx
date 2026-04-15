"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Eye,
  Download,
  Plus,
  Pencil,
  Trash2,
  Share2,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  History,
  Loader2,
  MapPin,
  Monitor,
  Filter,
} from "lucide-react";
import {
  driveAuditApi,
  type AuditLogEntry,
  type ChainVerification,
} from "@/lib/api/storage";

// ─── Action config ───────────────────────────────────────────

interface ActionConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorCls: string;
  bgCls: string;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  view: {
    label: "Consultation",
    icon: Eye,
    colorCls: "text-blue-600 dark:text-blue-400",
    bgCls: "bg-blue-100 dark:bg-blue-900/30",
  },
  download: {
    label: "Téléchargement",
    icon: Download,
    colorCls: "text-blue-600 dark:text-blue-400",
    bgCls: "bg-blue-100 dark:bg-blue-900/30",
  },
  create: {
    label: "Création",
    icon: Plus,
    colorCls: "text-green-600 dark:text-green-400",
    bgCls: "bg-green-100 dark:bg-green-900/30",
  },
  update: {
    label: "Modification",
    icon: Pencil,
    colorCls: "text-amber-600 dark:text-amber-400",
    bgCls: "bg-amber-100 dark:bg-amber-900/30",
  },
  move: {
    label: "Déplacement",
    icon: Pencil,
    colorCls: "text-amber-600 dark:text-amber-400",
    bgCls: "bg-amber-100 dark:bg-amber-900/30",
  },
  rename: {
    label: "Renommage",
    icon: Pencil,
    colorCls: "text-amber-600 dark:text-amber-400",
    bgCls: "bg-amber-100 dark:bg-amber-900/30",
  },
  delete: {
    label: "Suppression",
    icon: Trash2,
    colorCls: "text-red-600 dark:text-red-400",
    bgCls: "bg-red-100 dark:bg-red-900/30",
  },
  share: {
    label: "Partage",
    icon: Share2,
    colorCls: "text-purple-600 dark:text-purple-400",
    bgCls: "bg-purple-100 dark:bg-purple-900/30",
  },
  access_denied: {
    label: "Accès refusé",
    icon: ShieldAlert,
    colorCls: "text-red-600 dark:text-red-400",
    bgCls: "bg-red-100 dark:bg-red-900/30",
  },
};

const DEFAULT_ACTION_CONFIG: ActionConfig = {
  label: "Action",
  icon: History,
  colorCls: "text-muted-foreground",
  bgCls: "bg-muted",
};

function getActionConfig(action: string): ActionConfig {
  return ACTION_CONFIG[action] ?? DEFAULT_ACTION_CONFIG;
}

// ─── Country flag from geo ───────────────────────────────────

function GeoFlag({ geo }: { geo?: string }) {
  if (!geo) return null;
  // geo is expected as "FR", "US", etc. — country code
  const countryCode = geo.toUpperCase();
  return (
    <span
      title={countryCode}
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
    >
      <MapPin className="h-3 w-3" />
      {countryCode}
    </span>
  );
}

// ─── Single entry ────────────────────────────────────────────

function TimelineEntry({ entry }: { entry: AuditLogEntry }) {
  const cfg = getActionConfig(entry.action);
  const Icon = cfg.icon;
  const actorName = entry.actor_name ?? entry.actor_id;
  const date = new Date(entry.created_at);

  const dateStr = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex gap-3 py-3 group">
      {/* Icon */}
      <div
        className={`mt-0.5 h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${cfg.bgCls}`}
      >
        <Icon className={`h-4 w-4 ${cfg.colorCls}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {actorName}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            {cfg.label}
          </Badge>
        </div>

        {entry.node_path && (
          <p
            className="text-xs text-muted-foreground truncate max-w-[300px]"
            title={entry.node_path}
          >
            {entry.node_path}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className="text-[10px] text-muted-foreground">
            {dateStr} à {timeStr}
          </span>
          {entry.actor_ip && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Monitor className="h-3 w-3" />
              {entry.actor_ip}
            </span>
          )}
          <GeoFlag geo={entry.actor_geo} />
        </div>

        {entry.file_hash && (
          <p
            className="text-[9px] text-muted-foreground/60 font-mono truncate max-w-[280px]"
            title={`SHA256: ${entry.file_hash}`}
          >
            SHA256: {entry.file_hash.substring(0, 16)}…
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Chain integrity banner ──────────────────────────────────

function ChainBanner({
  verification,
}: {
  verification: ChainVerification | null;
}) {
  if (!verification) return null;

  if (verification.valid) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-xs text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="font-medium">Chaîne intègre</span>
        <span className="text-green-600/70 dark:text-green-500/70">
          ({verification.total_entries} entrées vérifiées)
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
      <XCircle className="h-4 w-4 shrink-0" />
      <span className="font-medium">Chaîne corrompue</span>
      {verification.first_corrupt_index !== undefined && (
        <span className="text-red-600/70 dark:text-red-500/70">
          (entrée #{verification.first_corrupt_index + 1})
        </span>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export interface AuditTimelineProps {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_OPTIONS = [
  { value: "all", label: "Toutes les actions" },
  { value: "view", label: "Consultation" },
  { value: "download", label: "Téléchargement" },
  { value: "create", label: "Création" },
  { value: "update", label: "Modification" },
  { value: "delete", label: "Suppression" },
  { value: "share", label: "Partage" },
  { value: "access_denied", label: "Accès refusé" },
];

export function AuditTimeline({
  nodeId,
  open,
  onOpenChange,
}: AuditTimelineProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [verification, setVerification] = useState<ChainVerification | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadEntries = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    try {
      const res = await driveAuditApi.list({
        node_id: nodeId,
        action: actionFilter !== "all" ? actionFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 100,
      });
      setEntries(res.data ?? []);
    } catch {
      toast.error("Impossible de charger l'historique");
    } finally {
      setLoading(false);
    }
  }, [nodeId, actionFilter, dateFrom, dateTo]);

  const loadVerification = useCallback(async () => {
    try {
      const res = await driveAuditApi.verify();
      setVerification(res.data);
    } catch {
      // Silently ignore — verification is optional
    }
  }, []);

  useEffect(() => {
    if (open && nodeId) {
      loadEntries();
      loadVerification();
    }
  }, [open, nodeId, loadEntries, loadVerification]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await driveAuditApi.export({
        format: "csv",
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${nodeId}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const filteredEntries =
    actionFilter === "all"
      ? entries
      : entries.filter((e) => e.action === actionFilter);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[440px] sm:w-[520px] flex flex-col overflow-hidden p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary shrink-0" />
              Historique d&apos;accès
            </SheetTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Exporter
            </Button>
          </div>

          {/* Chain integrity */}
          <ChainBanner verification={verification} />

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-7 text-xs w-[170px]">
                <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-xs"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-7 text-xs rounded-md border border-input bg-background px-2 w-[130px] focus:outline-none focus:ring-1 focus:ring-ring"
              title="Depuis"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-7 text-xs rounded-md border border-input bg-background px-2 w-[130px] focus:outline-none focus:ring-1 focus:ring-ring"
              title="Jusqu'au"
            />
          </div>
        </SheetHeader>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <History className="h-10 w-10 opacity-20" />
              <p>Aucun événement trouvé</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredEntries.map((entry) => (
                <TimelineEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
