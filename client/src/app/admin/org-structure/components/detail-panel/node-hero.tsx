"use client";

/**
 * node-hero - contextual hero card displayed at the top of the
 * DetailPanel when a Node is selected.
 *
 * Shows :
 * - Kind badge + name + breadcrumb + code
 * - 3 KPI cards (live, from /org/panel-layouts/metrics)
 * - Quick actions driven by the panel layout config
 */
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { orgApi } from "@/lib/api/org";
import { getNodeTypeConfig } from "../tab-config";
import type { OrgNode } from "@/types/org";
import type { PanelHeroKpi } from "@/lib/api/org";
import { Edit, Move, Plus, Star, Trash2, X } from "lucide-react";

export interface NodeHeroProps {
  node: OrgNode;
  breadcrumb: string[];
  kpis: PanelHeroKpi[];
  quickActions: string[];
  boardDecisionMaker: {
    name: string;
    inherited: boolean;
    inheritedFrom?: string;
  } | null;
  onClose: () => void;
  onAddChild: (parent: OrgNode) => void;
  onMoveNode: (node: OrgNode) => void;
  onDeleteNode: (node: OrgNode) => void;
  onEditFocus: () => void;
  focusMode: boolean;
}

interface KpiValue {
  id: string;
  label: string;
  value: number | null;
  loading: boolean;
}

const QUICK_ACTION_BUILTINS: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  add_child: { label: "Ajouter enfant", icon: Plus },
  move: { label: "Déplacer", icon: Move },
  edit: { label: "Éditer", icon: Edit },
  delete: { label: "Supprimer", icon: Trash2 },
};

export function NodeHero({
  node,
  breadcrumb,
  kpis,
  quickActions,
  boardDecisionMaker,
  onClose,
  onAddChild,
  onMoveNode,
  onDeleteNode,
  onEditFocus,
  focusMode,
}: NodeHeroProps) {
  const cfg = getNodeTypeConfig(node.node_type);

  const [kpiValues, setKpiValues] = useState<KpiValue[]>([]);

  useEffect(() => {
    let cancelled = false;
    const items: KpiValue[] = kpis
      .slice(0, 3)
      .filter((k): k is { type: "builtin"; id: string } => k.type === "builtin")
      .map((k) => ({
        id: k.id,
        label: k.id,
        value: null,
        loading: true,
      }));
    setKpiValues(items);
    if (items.length === 0) return () => {};

    Promise.all(
      items.map((k) =>
        orgApi.panelLayouts
          .metric(k.id, node.id, "node")
          .then((res) => ({
            id: k.id,
            label: res.data.label,
            value: res.data.value,
            loading: false,
          }))
          .catch(() => ({
            id: k.id,
            label: k.id,
            value: null,
            loading: false,
          })),
      ),
    ).then((resolved) => {
      if (cancelled) return;
      setKpiValues(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [node.id, kpis]);

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case "add_child":
        onAddChild(node);
        break;
      case "move":
        onMoveNode(node);
        break;
      case "edit":
        onEditFocus();
        break;
      case "delete":
        onDeleteNode(node);
        break;
      default:
        break;
    }
  };

  return (
    <div className="border-b border-border shrink-0 bg-card">
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge
              variant="secondary"
              className={cn("text-xs px-2 py-0.5 shrink-0", cfg.color, cfg.bg)}
            >
              {cfg.label}
            </Badge>
            <h2 className="font-semibold text-base truncate">{node.name}</h2>
          </div>
          {breadcrumb.length > 0 && (
            <p
              className="text-xs text-muted-foreground truncate"
              title={breadcrumb.join(" > ") + " > " + node.name}
            >
              {breadcrumb.join(" > ")} &gt; {node.name}
            </p>
          )}
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            {node.code && <span className="font-mono">Code: {node.code}</span>}
            {boardDecisionMaker && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                <span className="font-medium text-foreground">
                  {boardDecisionMaker.name}
                </span>
                {boardDecisionMaker.inherited &&
                  boardDecisionMaker.inheritedFrom && (
                    <span>(hérité de {boardDecisionMaker.inheritedFrom})</span>
                  )}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-7 w-7 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI cards row */}
      {kpiValues.length > 0 && (
        <div className="px-4 pb-2 grid grid-cols-3 gap-2">
          {kpiValues.map((kpi) => (
            <div
              key={kpi.id}
              className="rounded-md border border-border bg-muted/30 px-2 py-1.5"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                {kpi.label}
              </p>
              {kpi.loading ? (
                <div className="h-5 bg-muted rounded animate-pulse w-8 mt-0.5" />
              ) : (
                <p className="text-base font-semibold tabular-nums">
                  {kpi.value ?? "—"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick actions row */}
      {quickActions.length > 0 && !focusMode && (
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {quickActions
            .filter((id) => id in QUICK_ACTION_BUILTINS)
            .map((id) => {
              const def = QUICK_ACTION_BUILTINS[id];
              const Icon = def.icon;
              const isDelete = id === "delete";
              return (
                <Button
                  key={id}
                  variant={isDelete ? "ghost" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 px-2 text-xs",
                    isDelete && "text-destructive hover:text-destructive",
                  )}
                  onClick={() => handleAction(id)}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {def.label}
                </Button>
              );
            })}
        </div>
      )}
    </div>
  );
}
