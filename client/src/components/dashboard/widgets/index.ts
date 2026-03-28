/**
 * Dashboard Widgets Index
 *
 * Export centralisé de tous les widgets.
 */

// Existing widgets
export { WidgetStatCards } from "../widget-stat-cards";
export { WidgetInstalledApps } from "../widget-installed-apps";
export { WidgetSystemHealth } from "../widget-system-health";
export { WidgetQuickActions } from "../widget-quick-actions";
export { WidgetNetworkTraffic } from "../widget-network-traffic";
export { WidgetBookmarks } from "../widget-bookmarks";
export { WidgetProxyStatus } from "../widget-proxy-status";

// New widgets
export { WidgetRecentTasks } from "./widget-recent-tasks";
export { WidgetUpcomingEvents } from "./widget-upcoming-events";
export { WidgetRecentFiles } from "./widget-recent-files";
export { WidgetRecentEmails } from "./widget-recent-emails";
export { WidgetTodayCalendar } from "./widget-today-calendar";
export { WidgetTasksSummary } from "./widget-tasks-summary";
export { WidgetUnreadEmails } from "./widget-unread-emails";
export { WidgetActiveTasks } from "./widget-active-tasks";

// Dashboard customization: extended widgets
export { WidgetActivityHeatmap } from "./widget-activity-heatmap";
export { WidgetFavorites } from "./widget-favorites";
export { WidgetCalendarPreview } from "./widget-calendar-preview";
