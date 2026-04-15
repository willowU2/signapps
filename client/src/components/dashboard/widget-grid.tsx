"use client";

import { useMemo, useCallback } from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  Layout,
} from "react-grid-layout";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import {
  useDashboardStore,
  useDashboardWidgets,
  useDashboardEditMode,
  useDashboardWidgetActions,
  WidgetConfig,
} from "@/stores/dashboard-store";
import { useContainers } from "@/hooks/use-containers";

// Core widgets
import { WidgetStatCards } from "./widget-stat-cards";
import { WidgetInstalledApps } from "./widget-installed-apps";
import { WidgetSystemHealth } from "./widget-system-health";
import { WidgetQuickActions } from "./widget-quick-actions";
import { WidgetNetworkTraffic } from "./widget-network-traffic";
import { WidgetBookmarks } from "./widget-bookmarks";
import { WidgetProxyStatus } from "./widget-proxy-status";
// Productivity widgets
import { WidgetRecentTasks } from "./widgets/widget-recent-tasks";
import { WidgetUpcomingEvents } from "./widgets/widget-upcoming-events";
import { WidgetRecentFiles } from "./widgets/widget-recent-files";
import { WidgetRecentEmails } from "./widgets/widget-recent-emails";
import { WidgetTodayCalendar } from "./widgets/widget-today-calendar";
import { WidgetTasksSummary } from "./widgets/widget-tasks-summary";
import { WidgetUnreadEmails } from "./widgets/widget-unread-emails";
import { WidgetActiveTasks } from "./widgets/widget-active-tasks";
// Unified dashboard widgets (previously hardcoded sections)
import { WidgetAiDailyBrief } from "./widgets/widget-ai-daily-brief";
import { WidgetUnifiedStats } from "./widgets/widget-unified-stats";
import { WidgetTodayView } from "./widgets/widget-today-view";
import { WidgetActivityFeed } from "./widgets/widget-activity-feed";
import { WidgetAllApps } from "./widgets/widget-all-apps";
import { WidgetKpiCards } from "./widgets/widget-kpi-cards";
// Missing widget imports (previously flagged)
import { WidgetNotificationCenter } from "./widgets/widget-notification-center";
import { WidgetActivityTimeline } from "./widgets/widget-activity-timeline";
import { WidgetStorageUsage } from "./widgets/widget-storage-usage";
import { WidgetPerformanceChart } from "./widgets/widget-performance-chart";
// IDEA-122: Extended widget library
import { WidgetWeather } from "./widgets/widget-weather";
import { WidgetRssFeed } from "./widgets/widget-rss-feed";
import { WidgetQuickNotes } from "./widgets/widget-quick-notes";
// Dashboard customization: extended widgets
import { WidgetActivityHeatmap } from "./widgets/widget-activity-heatmap";
import { WidgetFavorites } from "./widgets/widget-favorites";
import { WidgetCalendarPreview } from "./widgets/widget-calendar-preview";
// AgentIQ widgets
import { AgentiqAgentsWidget } from "./widgets/agentiq-agents";
import { AgentiqSubagentsWidget } from "./widgets/agentiq-subagents";
import { AgentiqReviewersWidget } from "./widgets/agentiq-reviewers";
import { AgentiqIdeasWidget } from "./widgets/agentiq-ideas";
import { AgentiqPipelineWidget } from "./widgets/agentiq-pipeline";
import { AgentiqTimelineWidget } from "./widgets/agentiq-timeline";
import { AgentiqGuidelinesWidget } from "./widgets/agentiq-guidelines";
import { AgentiqHealthWidget } from "./widgets/agentiq-health";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

function WidgetRenderer({ widget }: { widget: WidgetConfig }) {
  const renderProps = {
    widget: {
      ...widget,
      config: widget.config || {},
    },
    isEditing: false,
  };

  switch (widget.type) {
    case "stat-cards":
      return <WidgetStatCards />;
    case "installed-apps":
      return <WidgetInstalledApps />;
    case "system-health":
      return <WidgetSystemHealth />;
    case "quick-actions":
      return <WidgetQuickActions />;
    case "network-traffic":
      return <WidgetNetworkTraffic />;
    case "bookmarks":
      return <WidgetBookmarks />;
    case "proxy-status":
      return <WidgetProxyStatus />;
    case "recent-tasks":
      return <WidgetRecentTasks {...renderProps} />;
    case "upcoming-events":
      return <WidgetUpcomingEvents {...renderProps} />;
    case "recent-files":
      return <WidgetRecentFiles {...renderProps} />;
    case "recent-emails":
      return <WidgetRecentEmails {...renderProps} />;
    case "today-calendar":
      return <WidgetTodayCalendar {...renderProps} />;
    case "tasks-summary":
      return <WidgetTasksSummary {...renderProps} />;
    case "unread-emails":
      return <WidgetUnreadEmails {...renderProps} />;
    case "active-tasks":
      return <WidgetActiveTasks {...renderProps} />;
    // Unified dashboard widgets
    case "ai-daily-brief":
      return <WidgetAiDailyBrief {...renderProps} />;
    case "unified-stats":
      return <WidgetUnifiedStats {...renderProps} />;
    case "today-view":
      return <WidgetTodayView {...renderProps} />;
    case "activity-feed":
      return <WidgetActivityFeed {...renderProps} />;
    case "all-apps":
      return <WidgetAllApps {...renderProps} />;
    case "kpi-cards":
      return <WidgetKpiCards {...renderProps} />;
    // Previously missing imports — now wired
    case "notifications":
      return <WidgetNotificationCenter {...renderProps} />;
    case "team-activity":
      return <WidgetActivityTimeline {...renderProps} />;
    case "recent-activity":
      return <WidgetActivityTimeline {...renderProps} />;
    case "storage-usage":
      return <WidgetStorageUsage {...renderProps} />;
    case "performance-chart":
      return <WidgetPerformanceChart {...renderProps} />;
    // IDEA-122: Extended widget library
    case "weather":
      return <WidgetWeather {...renderProps} />;
    case "rss-feed":
      return <WidgetRssFeed {...renderProps} />;
    case "quick-notes":
      return <WidgetQuickNotes {...renderProps} />;
    // Dashboard customization: extended widgets
    case "activity-heatmap":
      return <WidgetActivityHeatmap {...renderProps} />;
    case "favorites":
      return <WidgetFavorites {...renderProps} />;
    case "calendar-preview":
      return <WidgetCalendarPreview {...renderProps} />;
    // AgentIQ widgets
    case "agentiq-agents":
      return <AgentiqAgentsWidget {...renderProps} />;
    case "agentiq-subagents":
      return <AgentiqSubagentsWidget {...renderProps} />;
    case "agentiq-reviewers":
      return <AgentiqReviewersWidget {...renderProps} />;
    case "agentiq-ideas":
      return <AgentiqIdeasWidget {...renderProps} />;
    case "agentiq-pipeline":
      return <AgentiqPipelineWidget {...renderProps} />;
    case "agentiq-timeline":
      return <AgentiqTimelineWidget {...renderProps} />;
    case "agentiq-guidelines":
      return <AgentiqGuidelinesWidget {...renderProps} />;
    case "agentiq-health":
      return <AgentiqHealthWidget {...renderProps} />;
    default:
      return (
        <div className="p-4 text-muted-foreground text-center">
          Widget inconnu: {widget.type}
        </div>
      );
  }
}

function computeInstalledAppsH(appCount: number): number {
  const cols = 4;
  const rows = Math.ceil(appCount / cols);
  return Math.max(3, 2 + rows);
}

// Compact layout vertically: push widgets down if they overlap with widgets above
function compactLayout(
  items: {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW: number;
    minH: number;
  }[],
) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = 0; j < i; j++) {
      const above = sorted[j];
      const current = sorted[i];
      const hOverlap =
        current.x < above.x + above.w && current.x + current.w > above.x;
      if (hOverlap && current.y < above.y + above.h) {
        sorted[i] = { ...current, y: above.y + above.h };
      }
    }
  }
  return sorted;
}

export function WidgetGrid() {
  // Granular selectors for optimized re-renders
  const widgets = useDashboardWidgets();
  const editMode = useDashboardEditMode();
  const { updateLayout, removeWidget } = useDashboardWidgetActions();
  const { width, containerRef, mounted } = useContainerWidth();
  const { data: containers = [] } = useContainers();

  const installedAppsCount = containers.filter(
    (c) => c.is_managed && !c.is_system && c.state === "running",
  ).length;

  const lgLayout = useMemo<Layout>(() => {
    const items = widgets.map((w) => ({
      i: w.id,
      x: w.x,
      y: w.y,
      w: w.w,
      h:
        w.type === "installed-apps"
          ? computeInstalledAppsH(installedAppsCount)
          : w.h,
      minW: 3,
      minH: 2,
    }));
    return compactLayout(items);
  }, [widgets, installedAppsCount]);

  const onLayoutChange = useCallback(
    (currentLayout: Layout) => {
      if (!editMode) return;
      updateLayout(
        currentLayout as unknown as {
          i: string;
          x: number;
          y: number;
          w: number;
          h: number;
        }[],
      );
    },
    [editMode, updateLayout],
  );

  return (
    <div ref={containerRef}>
      {mounted && (
        <ResponsiveGridLayout
          className="layout"
          width={width}
          layouts={{ lg: lgLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          dragConfig={{
            enabled: editMode,
            handle: ".widget-drag-handle",
          }}
          resizeConfig={{
            enabled: editMode,
          }}
          onLayoutChange={onLayoutChange}
          margin={[16, 16] as const}
        >
          {widgets.map((widget, index) => (
            <div
              key={widget.id}
              className={`relative ${editMode ? "ring-2 ring-dashed ring-primary/30 rounded-lg" : ""}`}
            >
              {editMode && (
                <>
                  <div className="widget-drag-handle absolute inset-x-0 top-0 z-10 flex h-6 cursor-move items-center justify-center rounded-t-lg bg-primary/10">
                    <div className="h-1 w-8 rounded bg-primary/40" />
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -right-2 -top-2 z-20 h-6 w-6 rounded-full shadow-md"
                    onClick={() => removeWidget(widget.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
              <motion.div
                className={editMode ? "pt-6 h-full" : "h-full"}
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.08,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <WidgetRenderer widget={widget} />
              </motion.div>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
