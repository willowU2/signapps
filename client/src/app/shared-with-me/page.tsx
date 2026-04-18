"use client";

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Share2 } from "lucide-react";
import { sharingApi } from "@/lib/api/sharing";
import type { SharingGrant, SharingResourceType } from "@/types/sharing";
import {
  SHARING_RESOURCE_TYPE_LABELS,
  SHARING_ROLE_LABELS,
} from "@/types/sharing";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Role badge colors ──────────────────────────────────────────────────────

const ROLE_BADGE_CLS: Record<string, string> = {
  viewer: "bg-muted text-muted-foreground border-border",
  editor:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  manager:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  deny: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
};

// ─── Resource type options ──────────────────────────────────────────────────

const ALL_RESOURCE_TYPES = Object.keys(
  SHARING_RESOURCE_TYPE_LABELS,
) as SharingResourceType[];

// ─── Helper: group grants by resource_type ──────────────────────────────────

function groupByType(grants: SharingGrant[]): Map<string, SharingGrant[]> {
  const map = new Map<string, SharingGrant[]>();
  for (const grant of grants) {
    const existing = map.get(grant.resource_type) ?? [];
    map.set(grant.resource_type, [...existing, grant]);
  }
  return map;
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function SharedWithMeSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border border-border">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Grant card item ─────────────────────────────────────────────────────────

interface GrantItemProps {
  grant: SharingGrant;
}

function GrantItem({ grant }: GrantItemProps) {
  const roleCls = ROLE_BADGE_CLS[grant.role] ?? ROLE_BADGE_CLS["viewer"];
  const roleLabel =
    SHARING_ROLE_LABELS[grant.role as keyof typeof SHARING_ROLE_LABELS] ??
    grant.role;
  const shortId = grant.resource_id.slice(0, 8) + "…";

  return (
    <div className="flex items-center gap-3 py-2 group">
      {/* Resource icon placeholder */}
      <div className="h-9 w-9 shrink-0 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
        <Share2 className="h-4 w-4" />
      </div>

      {/* Resource info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium text-foreground truncate"
          title={grant.resource_id}
        >
          {shortId}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Partagé le{" "}
          {new Date(grant.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {grant.expires_at && (
            <span className="ml-1.5">
              · Expire le{" "}
              {new Date(grant.expires_at).toLocaleDateString("fr-FR")}
            </span>
          )}
        </p>
      </div>

      {/* Role badge */}
      <Badge
        variant="outline"
        className={`text-xs font-medium shrink-0 ${roleCls}`}
      >
        {roleLabel}
      </Badge>

      {/* Open link — placeholder */}
      <button
        type="button"
        className="text-xs text-primary underline-offset-2 hover:underline opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label={`Ouvrir la ressource ${grant.resource_id}`}
      >
        Ouvrir
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SharedWithMePage() {
  usePageTitle("Partagés avec moi");

  const [filterType, setFilterType] = useState<SharingResourceType | "all">(
    "all",
  );
  const [grants, setGrants] = useState<SharingGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const type = filterType === "all" ? undefined : filterType;
    sharingApi
      .sharedWithMe(type)
      .then((data) => {
        if (!cancelled) setGrants(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger les partages",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filterType]);

  const grouped = groupByType(grants);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Partagés avec moi
              </h1>
              <p className="text-sm text-muted-foreground">
                Toutes les ressources que d&apos;autres utilisateurs ont
                partagées avec vous
              </p>
            </div>
          </div>

          {/* Filter */}
          <Select
            value={filterType}
            onValueChange={(v) =>
              setFilterType(v as SharingResourceType | "all")
            }
          >
            <SelectTrigger className="h-9 w-[180px] text-sm shrink-0">
              <SelectValue placeholder="Tous les types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">
                Tous les types
              </SelectItem>
              {ALL_RESOURCE_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="text-sm">
                  {SHARING_RESOURCE_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {loading ? (
          <SharedWithMeSkeleton />
        ) : error ? (
          <Card className="border border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
              <span>{error}</span>
            </CardContent>
          </Card>
        ) : grants.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Share2 className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                Aucun élément partagé avec vous
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Les ressources partagées par vos collègues apparaîtront ici.
              </p>
            </div>
          </div>
        ) : (
          /* Grouped list */
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([resourceType, items]) => {
              const typeLabel =
                SHARING_RESOURCE_TYPE_LABELS[
                  resourceType as SharingResourceType
                ] ?? resourceType;

              return (
                <Card key={resourceType} className="border border-border">
                  <CardHeader className="pb-1 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <span>{typeLabel}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1.5"
                      >
                        {items.length}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="sr-only">
                      {items.length} élément
                      {items.length > 1 ? "s" : ""} de type {typeLabel}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-3">
                    <div className="divide-y divide-border/50">
                      {items.map((grant) => (
                        <GrantItem key={grant.id} grant={grant} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
