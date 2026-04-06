"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { Activity, RefreshCw } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { sharingApi } from "@/lib/api/sharing";
import type { SharingAuditEntry } from "@/types/sharing";
import {
  SHARING_AUDIT_ACTION_LABELS,
  SHARING_RESOURCE_TYPE_LABELS,
} from "@/types/sharing";

// ─── Action badge colours ─────────────────────────────────────────────────────

const ACTION_BADGE_CLS: Record<string, string> = {
  grant_created:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  grant_revoked:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  access_denied:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  deny_set:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  template_applied:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  template_deleted:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
};

const DEFAULT_BADGE_CLS = "bg-muted text-muted-foreground border-border";

// ─── Resource type options for filter ────────────────────────────────────────

const RESOURCE_TYPE_OPTIONS = [
  { value: "all", label: "Tous les types" },
  { value: "file", label: "Fichier" },
  { value: "folder", label: "Dossier" },
  { value: "calendar", label: "Calendrier" },
  { value: "event", label: "Événement" },
  { value: "document", label: "Document" },
  { value: "template", label: "Template" },
  { value: "vault_entry", label: "Secret" },
  { value: "channel", label: "Canal" },
  { value: "form", label: "Formulaire" },
  { value: "contact_book", label: "Carnet d'adresses" },
  { value: "asset", label: "Actif IT" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortUuid(id: string): string {
  return id.slice(0, 8) + "…";
}

function resourceTypeLabel(rt: string): string {
  return (
    SHARING_RESOURCE_TYPE_LABELS[
      rt as keyof typeof SHARING_RESOURCE_TYPE_LABELS
    ] ?? rt
  );
}

// ─── Audit row ────────────────────────────────────────────────────────────────

interface AuditRowProps {
  entry: SharingAuditEntry;
}

function AuditRow({ entry }: AuditRowProps) {
  const badgeCls = ACTION_BADGE_CLS[entry.action] ?? DEFAULT_BADGE_CLS;
  const actionLabel = SHARING_AUDIT_ACTION_LABELS[entry.action] ?? entry.action;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      {/* Timestamp */}
      <span className="text-[11px] text-muted-foreground shrink-0 w-[130px] pt-0.5 tabular-nums">
        {formatDate(entry.created_at)}
      </span>

      {/* Action badge */}
      <Badge
        variant="outline"
        className={`text-[11px] h-5 px-1.5 shrink-0 ${badgeCls}`}
      >
        {actionLabel}
      </Badge>

      {/* Resource */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 w-[140px]">
        <span className="font-medium text-foreground">
          {resourceTypeLabel(entry.resource_type)}
        </span>
        <span title={entry.resource_id} className="font-mono text-[10px]">
          {shortUuid(entry.resource_id)}
        </span>
      </div>

      {/* Actor */}
      <span
        className="text-[11px] font-mono text-muted-foreground shrink-0 w-[90px]"
        title={entry.actor_id}
      >
        {shortUuid(entry.actor_id)}
      </span>

      {/* Details */}
      {entry.details && Object.keys(entry.details).length > 0 && (
        <span
          className="text-[10px] font-mono text-muted-foreground truncate flex-1"
          title={JSON.stringify(entry.details)}
        >
          {JSON.stringify(entry.details)}
        </span>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AuditSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-3 border-b border-border last:border-0"
        >
          <Skeleton className="h-3 w-[130px]" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3 w-[140px]" />
          <Skeleton className="h-3 w-[90px]" />
          <Skeleton className="h-3 flex-1" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SharingAuditPage() {
  usePageTitle("Audit de partage");

  const [entries, setEntries] = useState<SharingAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all");

  const loadAudit = useCallback(() => {
    setLoading(true);
    setError(null);

    const params =
      resourceTypeFilter !== "all"
        ? { resource_type: resourceTypeFilter, limit: 200 }
        : { limit: 200 };

    sharingApi
      .listAudit(params)
      .then((data) => setEntries(data))
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Impossible de charger l'audit",
        );
      })
      .finally(() => setLoading(false));
  }, [resourceTypeFilter]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Audit de partage"
          description="Historique immuable de toutes les mutations du système de partage — grants, révocations, templates."
          icon={<Activity className="h-5 w-5 text-primary" />}
          badge={
            !loading && entries.length > 0 ? (
              <Badge variant="secondary" className="text-xs h-5 px-2">
                {entries.length}
              </Badge>
            ) : undefined
          }
          actions={
            <div className="flex items-center gap-2">
              {/* Resource type filter */}
              <Select
                value={resourceTypeFilter}
                onValueChange={setResourceTypeFilter}
              >
                <SelectTrigger className="h-9 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPE_OPTIONS.map((opt) => (
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

              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={loadAudit}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Actualiser
              </Button>
            </div>
          }
        />

        {/* Content */}
        {loading ? (
          <Card className="border border-border">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">
                Chargement…
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <AuditSkeleton />
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center justify-between gap-3 py-4 text-sm text-destructive">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAudit}
                className="shrink-0"
              >
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Activity className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                Aucune entrée d&apos;audit
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Les mutations du système de partage apparaîtront ici.
              </p>
            </div>
          </div>
        ) : (
          <Card className="border border-border">
            <CardHeader className="pb-2 pt-4 px-5">
              {/* Column headers */}
              <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="w-[130px] shrink-0">Date</span>
                <span className="w-24 shrink-0">Action</span>
                <span className="w-[140px] shrink-0">Ressource</span>
                <span className="w-[90px] shrink-0">Acteur</span>
                <span className="flex-1">Détails</span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div>
                {entries.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
