"use client";

/**
 * RBAC Visualizer — side panel listing the effective permissions of a
 * given person, grouped by resource category, each with its source
 * (direct / node / role / delegation).
 *
 * Used in:
 * - `people-tab.tsx`   (inline per-person popover)
 * - `detail-panel.tsx` (on demand via the person edit flow)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  PlayCircle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck2,
} from "lucide-react";
import { orgApi } from "@/lib/api/org";
import type {
  RbacEffectivePermission,
  RbacPermissionSource,
} from "@/lib/api/org";
import { cn } from "@/lib/utils";
import { SimulateDialog } from "./dialogs/simulate-dialog";

export interface RbacVizPanelProps {
  personId: string;
  personName?: string;
  /** Optional close button — when omitted the panel is embedded. */
  onClose?: () => void;
}

export function RbacVizPanel({
  personId,
  personName,
  onClose,
}: RbacVizPanelProps) {
  const [perms, setPerms] = useState<RbacEffectivePermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulateOpen, setSimulateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await orgApi.rbac.effective(personId);
      setPerms(res.data ?? []);
    } catch (e) {
      setError("Impossible de charger les permissions");
      console.error("RBAC viz load failed", e);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    load();
  }, [load]);

  // Group by resource category (first dotted segment).
  const grouped = useMemo(() => {
    const by: Record<string, RbacEffectivePermission[]> = {};
    for (const p of perms) {
      const cat = p.resource.includes(".")
        ? p.resource.split(".")[0]
        : p.resource || "*";
      if (!by[cat]) by[cat] = [];
      by[cat].push(p);
    }
    return by;
  }, [perms]);

  const categories = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="font-semibold text-sm truncate">
            Permissions effectives
          </h3>
          {personName && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {personName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSimulateOpen(true)}
            data-testid="rbac-simulate-button"
          >
            <PlayCircle className="h-3 w-3 mr-1" />
            Simuler
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onClose}
            >
              x
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-2">
          {loading && (
            <p className="text-xs text-muted-foreground">Chargement…</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!loading && !error && perms.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Aucune permission active.
            </p>
          )}
          {categories.map((cat) => (
            <CategorySection key={cat} name={cat} items={grouped[cat]} />
          ))}
        </div>
      </ScrollArea>

      <SimulateDialog
        personId={personId}
        personName={personName}
        open={simulateOpen}
        onOpenChange={setSimulateOpen}
      />
    </div>
  );
}

function CategorySection({
  name,
  items,
}: {
  name: string;
  items: RbacEffectivePermission[];
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border rounded-md bg-card">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <span className="uppercase tracking-wide">{name}</span>
        </span>
        <Badge variant="outline" className="text-[10px]">
          {items.length}
        </Badge>
      </button>
      {open && (
        <ul className="border-t border-border divide-y divide-border">
          {items.map((p, i) => (
            <PermissionRow key={`${p.resource}-${p.action}-${i}`} perm={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PermissionRow({ perm }: { perm: RbacEffectivePermission }) {
  const src = perm.source;
  return (
    <li className="flex items-start gap-2 px-3 py-1.5 text-xs">
      <span className="font-mono text-foreground min-w-[96px]">
        {perm.action}
      </span>
      <span className="text-muted-foreground flex-1 truncate">
        {perm.resource}
      </span>
      <SourceBadge source={src} />
    </li>
  );
}

function SourceBadge({ source }: { source: RbacPermissionSource }) {
  const { bg, label, icon: Icon, tip } = sourceVisual(source);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
              bg,
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[280px] text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function sourceVisual(source: RbacPermissionSource): {
  bg: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tip: string;
} {
  switch (source.type) {
    case "direct":
      return {
        bg: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
        label: "direct",
        icon: KeyRound,
        tip: `Attribué directement: ${source.ref_name}`,
      };
    case "node":
      return {
        bg: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
        label: "node",
        icon: ShieldCheck,
        tip: `Hérité du node "${source.ref_name}"`,
      };
    case "role":
      return {
        bg: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
        label: "role",
        icon: ShieldAlert,
        tip: `Via la policy "${source.ref_name}"`,
      };
    case "delegation":
      return {
        bg: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
        label: "delegation",
        icon: UserCheck2,
        tip: `Délégué par ${source.ref_name}`,
      };
  }
}
