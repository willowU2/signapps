"use client";

/**
 * tab-renderer - dispatch one tab item (builtin or widget) to its
 * React component. The `BuiltinTabRenderer` function is provided by
 * the parent so this file stays decoupled from the underlying tab
 * implementations.
 */
import type { PanelEntitySlug, PanelTabItem } from "@/lib/api/org";
import { Card, CardContent } from "@/components/ui/card";
import { IframeWidget } from "./widgets/iframe-widget";
import { KpiCardWidget } from "./widgets/kpi-card-widget";
import { LinkListWidget } from "./widgets/link-list-widget";
import { MarkdownNoteWidget } from "./widgets/markdown-note-widget";

export interface TabContext {
  entityId: string;
  entityType: PanelEntitySlug;
}

export interface TabRendererProps {
  item: PanelTabItem;
  ctx: TabContext;
  renderBuiltin: (id: string) => React.ReactNode;
}

export function TabRenderer({ item, ctx, renderBuiltin }: TabRendererProps) {
  if (item.type === "builtin") {
    return <>{renderBuiltin(item.id)}</>;
  }
  const widgetType = item.widget_type;
  const cfg = item.config ?? {};
  switch (widgetType) {
    case "kpi_card":
      return (
        <div className="p-4">
          <KpiCardWidget config={cfg} ctx={ctx} />
        </div>
      );
    case "iframe_embed":
      return <IframeWidget config={cfg} />;
    case "link_list":
      return <LinkListWidget config={cfg} />;
    case "markdown_note":
      return <MarkdownNoteWidget config={cfg} />;
    default:
      return (
        <Card className="m-4">
          <CardContent className="py-4 px-3">
            <p className="text-xs text-muted-foreground">
              Widget inconnu&nbsp;: <code>{widgetType}</code>
            </p>
          </CardContent>
        </Card>
      );
  }
}
