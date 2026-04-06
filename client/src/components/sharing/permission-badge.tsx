"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { sharingApi } from "@/lib/api/sharing";
import type {
  SharingResourceType,
  SharingRole,
  EffectivePermission,
} from "@/types/sharing";
import { SHARING_ROLE_LABELS } from "@/types/sharing";

// ─── Role color config ──────────────────────────────────────────────────────

const ROLE_BADGE_CLS: Record<SharingRole, string> = {
  viewer: "bg-muted text-muted-foreground border-border",
  editor:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  manager:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  deny: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
};

// ─── Capability labels ──────────────────────────────────────────────────────

const CAPABILITY_LABELS: Record<string, string> = {
  read: "Lecture",
  write: "Écriture",
  delete: "Suppression",
  manage_grants: "Gestion des accès",
  download: "Téléchargement",
  share: "Partage",
};

function formatCapability(cap: string): string {
  return CAPABILITY_LABELS[cap] ?? cap;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface PermissionBadgeProps {
  /** Type of the resource to check permission for. */
  resourceType: SharingResourceType;
  /** UUID of the resource. */
  resourceId: string;
  /**
   * If `true`, hovering the badge shows a tooltip listing the allowed
   * capabilities derived from the effective role.
   */
  showCapabilities?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Displays the authenticated user's effective role on a resource as a small
 * Badge. Optionally shows a capability tooltip on hover.
 *
 * Renders nothing while loading or on error.
 */
export function PermissionBadge({
  resourceType,
  resourceId,
  showCapabilities = false,
}: PermissionBadgeProps) {
  const [permission, setPermission] = useState<EffectivePermission | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    sharingApi
      .getEffectivePermission(resourceType, resourceId)
      .then((data) => {
        if (!cancelled) {
          setPermission(data);
        }
      })
      .catch(() => {
        // Silent fail — badge is informational
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceType, resourceId]);

  if (loading || !permission) return null;

  const badgeCls = ROLE_BADGE_CLS[permission.role];
  const label = SHARING_ROLE_LABELS[permission.role];

  const badge = (
    <Badge
      variant="outline"
      className={`text-xs font-medium select-none ${badgeCls}`}
    >
      {label}
    </Badge>
  );

  if (!showCapabilities || permission.capabilities.length === 0) {
    return badge;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px] space-y-1">
          <p className="font-semibold text-foreground mb-1">
            Capacités autorisées
          </p>
          <ul className="space-y-0.5">
            {permission.capabilities.map((cap) => (
              <li key={cap} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {formatCapability(cap)}
              </li>
            ))}
          </ul>
          {permission.can_reshare && (
            <p className="text-muted-foreground mt-1 border-t border-border pt-1">
              Peut re-partager cette ressource
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
