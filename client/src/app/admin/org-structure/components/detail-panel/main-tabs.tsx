"use client";

/**
 * main-tabs - renders the 5 primary tabs plus an overflow "..." menu
 * for tabs that don't fit in the main row.
 *
 * The split between "main" and "overflow" is driven by the panel
 * layout config (`config.main_tabs` = first 5 items, the rest go into
 * the dropdown). Hidden tabs never appear.
 */
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PanelTabItem } from "@/lib/api/org";

const MAX_MAIN_TABS = 5;

export interface TabMeta {
  id: string;
  label: string;
}

export interface MainTabsProps {
  /** Full ordered list of tab items from the panel layout. */
  items: PanelTabItem[];
  /** Metadata (label) for every known tab id (builtin + widget). */
  metaById: Record<string, TabMeta>;
  /** Tabs to hide outright (from config.hidden_tabs). */
  hiddenIds: string[];
  /** Currently active tab id. */
  activeId: string;
  /** Switch to a given tab. */
  onChange: (id: string) => void;
  /** Extra tabs (rendered last, kept for focus mode extras like delegations). */
  extraTabs?: TabMeta[];
  /** Apply a wider margin (focus mode). */
  wideMargin?: boolean;
}

/** Label for a widget tab item, falling back on the widget type. */
function widgetLabel(item: PanelTabItem): string {
  if (item.type !== "widget") return item.id;
  const cfg = item.config ?? {};
  if (typeof cfg.label === "string" && cfg.label.trim().length > 0) {
    return cfg.label;
  }
  switch (item.widget_type) {
    case "kpi_card":
      return "KPI";
    case "iframe_embed":
      return "Embed";
    case "link_list":
      return "Liens";
    case "markdown_note":
      return "Note";
    default:
      return item.widget_type;
  }
}

/** Derive a stable id for a widget tab item. */
function widgetId(item: PanelTabItem): string {
  if (item.type !== "widget") return item.id;
  const pos = typeof item.position === "number" ? item.position : 0;
  return "widget:" + item.widget_type + ":" + pos;
}

interface ResolvedItem {
  id: string;
  label: string;
  item: PanelTabItem;
}

function resolveItems(
  items: PanelTabItem[],
  hiddenIds: string[],
  metaById: Record<string, TabMeta>,
): ResolvedItem[] {
  const hidden = new Set(hiddenIds);
  return [...items]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((item): ResolvedItem | null => {
      if (item.type === "builtin") {
        if (hidden.has(item.id)) return null;
        const meta = metaById[item.id];
        return { id: item.id, label: meta?.label ?? item.id, item };
      }
      return { id: widgetId(item), label: widgetLabel(item), item };
    })
    .filter((x): x is ResolvedItem => x !== null);
}

export function MainTabs({
  items,
  metaById,
  hiddenIds,
  activeId,
  onChange,
  extraTabs = [],
  wideMargin = false,
}: MainTabsProps) {
  const [recentOverflow, setRecentOverflow] = useState<string[]>([]);
  const resolved = resolveItems(items, hiddenIds, metaById);

  const mainPrimary = resolved.slice(0, MAX_MAIN_TABS);
  const overflowRaw = resolved.slice(MAX_MAIN_TABS);

  // Promote recently-used overflow items to the head of the overflow list.
  const overflow = [
    ...recentOverflow
      .map((id) => overflowRaw.find((o) => o.id === id))
      .filter((x): x is ResolvedItem => Boolean(x)),
    ...overflowRaw.filter((o) => !recentOverflow.includes(o.id)),
  ];

  // If the active tab is in the overflow list and hasn't been
  // registered yet, register it so future renders keep it handy.
  if (
    !mainPrimary.find((o) => o.id === activeId) &&
    overflow.find((o) => o.id === activeId) &&
    !recentOverflow.includes(activeId)
  ) {
    // Safe during render — functional update + bounded list of ids.
    setTimeout(
      () => setRecentOverflow((prev) => [activeId, ...prev].slice(0, 3)),
      0,
    );
  }

  // Side-effect flush for recentOverflow tracking (no JSX needed at wrapper level).
  void activeId;
  void onChange;

  return (
    <TabsList
      className={cn(
        "mx-3 mt-2 pb-2 shrink-0 w-auto h-auto flex flex-wrap justify-start gap-0.5 bg-transparent p-0 border-b border-border",
        wideMargin && "mx-6",
      )}
    >
      {mainPrimary.map((t) => (
        <TabsTrigger
          key={t.id}
          value={t.id}
          className="text-xs px-2 py-1 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap"
        >
          {t.label}
        </TabsTrigger>
      ))}

      {extraTabs.map((t) => (
        <TabsTrigger
          key={t.id}
          value={t.id}
          className="text-xs px-2 py-1 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap"
        >
          {t.label}
        </TabsTrigger>
      ))}

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              title="Plus d'onglets"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {overflow.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  setRecentOverflow((prev) =>
                    [t.id, ...prev.filter((x) => x !== t.id)].slice(0, 3),
                  );
                }}
                className={cn(
                  "text-sm",
                  t.id === activeId && "bg-muted font-semibold",
                )}
              >
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </TabsList>
  );
}

/** Helper used by the container : list of all tab ids actually rendered. */
export function resolveVisibleTabIds(
  items: PanelTabItem[],
  hiddenIds: string[],
): string[] {
  return resolveItems(items, hiddenIds, {}).map((t) => t.id);
}
