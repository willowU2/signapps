"use client";

/**
 * Hierarchical list of sites — SO7.
 *
 * Given a flat list of [`OrgSiteRecord`] rows, rebuilds the parent/child
 * tree and renders it drill-down style. Clicking a site calls `onSelect`
 * so the parent page can show the detail panel.
 */
import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  DoorOpen,
  Laptop,
  Layers3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrgSiteRecord, OrgSiteKind } from "@/types/org";

const KIND_ICON: Record<OrgSiteKind, React.ReactNode> = {
  building: <Building2 className="h-4 w-4 text-primary" />,
  floor: <Layers3 className="h-4 w-4 text-muted-foreground" />,
  room: <DoorOpen className="h-4 w-4 text-muted-foreground" />,
  desk: <Laptop className="h-4 w-4 text-muted-foreground" />,
};

const KIND_LABEL: Record<OrgSiteKind, string> = {
  building: "Bâtiment",
  floor: "Étage",
  room: "Salle",
  desk: "Bureau",
};

export interface SiteTreeProps {
  sites: OrgSiteRecord[];
  selectedId?: string;
  onSelect: (site: OrgSiteRecord) => void;
}

interface SiteNode extends OrgSiteRecord {
  children: SiteNode[];
}

function buildTree(sites: OrgSiteRecord[]): SiteNode[] {
  const byId = new Map<string, SiteNode>();
  for (const s of sites) {
    byId.set(s.id, { ...s, children: [] });
  }
  const roots: SiteNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort children alphabetically for stable UI.
  for (const node of byId.values()) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
  }
  roots.sort((a, b) => a.name.localeCompare(b.name));
  return roots;
}

export function SiteTree({ sites, selectedId, onSelect }: SiteTreeProps) {
  const tree = useMemo(() => buildTree(sites), [sites]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    // Expand the buildings by default.
    for (const b of sites.filter((x) => x.kind === "building")) {
      s.add(b.id);
    }
    return s;
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (tree.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Aucun site. Commence par créer un bâtiment.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <SiteRow
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function SiteRow({
  node,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  node: SiteNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId?: string;
  onSelect: (site: OrgSiteRecord) => void;
}) {
  const isExpanded = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-1 py-1 pr-2 rounded-md cursor-pointer text-sm",
          isSelected ? "bg-accent" : "hover:bg-muted/50",
        )}
        style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
        onClick={() => onSelect(node)}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
          disabled={!hasChildren}
          aria-label={isExpanded ? "Replier" : "Déplier"}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : null}
        </Button>
        {KIND_ICON[node.kind]}
        <span className="flex-1 truncate">{node.name}</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          {KIND_LABEL[node.kind]}
        </Badge>
        {node.capacity != null && (
          <span className="text-xs text-muted-foreground">
            {node.capacity} pl.
          </span>
        )}
        {node.bookable && (
          <Badge
            variant="secondary"
            className="text-[10px] px-1 py-0 bg-emerald-500/15 text-emerald-700"
          >
            Bookable
          </Badge>
        )}
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <SiteRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}
