"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Download,
  Printer,
  FolderTree,
  LayoutGrid,
  List,
  MapPin,
  Network,
  Maximize2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgNode, OrgAxis } from "@/types/org";
import type { NodeTypeConfig } from "./tab-config";
import { AxisFilterChip } from "./axis-filter-chip";
import { TimeTravelSlider } from "./time-travel-slider";

export type ViewMode = "tree" | "orgchart" | "list";
export type NavTab = "tree" | "groups" | "sites";

export interface OrgToolbarProps {
  activeNavTab: NavTab;
  onNavTabChange: (tab: NavTab) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  selectedNode: OrgNode | null;
  nodeTypesByTree: Record<string, NodeTypeConfig>;
  onAddNode: (nodeType: string, parent: OrgNode | null) => void;
  onEnterFocusMode: () => void;
  onExport: (format: "json" | "csv") => void;
  onPrint: () => void;
  // SO1 — axis filter + time-travel
  axisFilter?: "all" | OrgAxis;
  onAxisFilterChange?: (axis: "all" | OrgAxis) => void;
  atDate?: string | null;
  onAtDateChange?: (iso: string | null) => void;
}

const NAV_TABS: Array<{ key: NavTab; label: string; icon: React.ReactNode }> = [
  { key: "tree", label: "Arbre", icon: <FolderTree className="h-3.5 w-3.5" /> },
  {
    key: "groups",
    label: "Groupes",
    icon: <Network className="h-3.5 w-3.5" />,
  },
  { key: "sites", label: "Sites", icon: <MapPin className="h-3.5 w-3.5" /> },
];

const VIEW_MODES = [
  { mode: "tree" as ViewMode, icon: FolderTree, label: "Arbre" },
  { mode: "orgchart" as ViewMode, icon: LayoutGrid, label: "Organigramme" },
  { mode: "list" as ViewMode, icon: List, label: "Liste" },
] as const;

export function OrgToolbar({
  activeNavTab,
  onNavTabChange,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchQueryChange,
  selectedNode,
  nodeTypesByTree,
  onAddNode,
  onEnterFocusMode,
  onExport,
  onPrint,
  axisFilter = "all",
  onAxisFilterChange,
  atDate = null,
  onAtDateChange,
}: OrgToolbarProps) {
  const readOnly = atDate !== null;
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card shrink-0 flex-wrap">
      {/* Nav tabs */}
      <div className="flex items-center bg-muted rounded-lg p-0.5">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onNavTabChange(tab.key)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              activeNavTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* View mode tabs (tree only) */}
      {activeNavTab === "tree" && (
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          {VIEW_MODES.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                viewMode === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative flex-1 min-w-[100px] max-w-[220px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Rechercher..."
          className="h-8 pl-8 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchQueryChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* SO1 — Axis filter chip */}
      {onAxisFilterChange && (
        <AxisFilterChip value={axisFilter} onChange={onAxisFilterChange} />
      )}

      {/* SO1 — Time-travel slider */}
      {onAtDateChange && (
        <TimeTravelSlider value={atDate} onChange={onAtDateChange} />
      )}

      {/* Add node dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={readOnly}
            title={readOnly ? "Vue historique, pas d'édition" : undefined}
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {selectedNode ? `Sous: ${selectedNode.name}` : "Noeud racine"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.entries(nodeTypesByTree).map(([type, typeCfg]) => (
            <DropdownMenuItem
              key={type}
              onClick={() => onAddNode(type, selectedNode)}
            >
              <span className={cn("text-xs font-medium mr-2", typeCfg.color)}>
                {typeCfg.label}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Focus mode button */}
      {selectedNode && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={onEnterFocusMode}
        >
          <Maximize2 className="h-4 w-4 mr-1" />
          Focus
        </Button>
      )}

      {/* Export / Print */}
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport("json")}>
              Exporter JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("csv")}>
              Exporter CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onPrint}
        >
          <Printer className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
