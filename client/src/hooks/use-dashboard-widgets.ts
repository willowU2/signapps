"use client";

// Feature 29: Drag-drop widget customization
// Feature 14: Custom metrics from multiple data sources
// Feature 26: Export current view as PDF

import { useState, useEffect, useCallback } from "react";

export type WidgetSize = "1x1" | "2x1" | "1x2" | "2x2" | "3x1" | "3x2";

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  size: WidgetSize;
  position: { col: number; row: number };
  config: Record<string, string | number | boolean>;
  visible: boolean;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  columns: number;
  updatedAt: string;
}

const KEY = "dashboard_custom_layout";

const DEFAULT_LAYOUT: DashboardLayout = {
  id: "default",
  name: "Mon tableau de bord",
  columns: 4,
  updatedAt: new Date().toISOString(),
  widgets: [
    {
      id: "w_myday",
      type: "my-day",
      title: "Ma journée",
      size: "2x2",
      position: { col: 0, row: 0 },
      config: {},
      visible: true,
    },
    {
      id: "w_activity",
      type: "activity-timeline",
      title: "Activité",
      size: "2x1",
      position: { col: 2, row: 0 },
      config: {},
      visible: true,
    },
    {
      id: "w_notifications",
      type: "notification-center",
      title: "Notifications",
      size: "1x1",
      position: { col: 2, row: 1 },
      config: {},
      visible: true,
    },
    {
      id: "w_deadlines",
      type: "upcoming-deadlines",
      title: "Échéances",
      size: "1x1",
      position: { col: 3, row: 1 },
      config: {},
      visible: true,
    },
    {
      id: "w_kpi",
      type: "kpi-cards",
      title: "KPIs",
      size: "3x1",
      position: { col: 0, row: 2 },
      config: {},
      visible: true,
    },
    {
      id: "w_projects",
      type: "project-progress",
      title: "Projets",
      size: "1x1",
      position: { col: 3, row: 2 },
      config: {},
      visible: true,
    },
    {
      id: "w_team",
      type: "team-feed",
      title: "Équipe",
      size: "2x1",
      position: { col: 0, row: 3 },
      config: {},
      visible: true,
    },
  ],
};

function load(): DashboardLayout {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function persist(layout: DashboardLayout) {
  localStorage.setItem(KEY, JSON.stringify(layout));
}

export function useDashboardWidgets() {
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);

  useEffect(() => {
    setLayout(load());
  }, []);

  const updateLayout = useCallback((patches: Partial<DashboardLayout>) => {
    const current = load();
    const next = {
      ...current,
      ...patches,
      updatedAt: new Date().toISOString(),
    };
    persist(next);
    setLayout(next);
  }, []);

  const moveWidget = useCallback(
    (id: string, position: { col: number; row: number }) => {
      const current = load();
      const next = {
        ...current,
        updatedAt: new Date().toISOString(),
        widgets: current.widgets.map((w) =>
          w.id === id ? { ...w, position } : w,
        ),
      };
      persist(next);
      setLayout(next);
    },
    [],
  );

  const resizeWidget = useCallback((id: string, size: WidgetSize) => {
    const current = load();
    const next = {
      ...current,
      updatedAt: new Date().toISOString(),
      widgets: current.widgets.map((w) => (w.id === id ? { ...w, size } : w)),
    };
    persist(next);
    setLayout(next);
  }, []);

  const toggleWidget = useCallback((id: string) => {
    const current = load();
    const next = {
      ...current,
      updatedAt: new Date().toISOString(),
      widgets: current.widgets.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w,
      ),
    };
    persist(next);
    setLayout(next);
  }, []);

  const addWidget = useCallback((widget: Omit<DashboardWidget, "id">) => {
    const current = load();
    const next = {
      ...current,
      updatedAt: new Date().toISOString(),
      widgets: [...current.widgets, { ...widget, id: `w_${Date.now()}` }],
    };
    persist(next);
    setLayout(next);
  }, []);

  const removeWidget = useCallback((id: string) => {
    const current = load();
    const next = {
      ...current,
      updatedAt: new Date().toISOString(),
      widgets: current.widgets.filter((w) => w.id !== id),
    };
    persist(next);
    setLayout(next);
  }, []);

  const resetLayout = useCallback(() => {
    persist(DEFAULT_LAYOUT);
    setLayout(DEFAULT_LAYOUT);
  }, []);

  return {
    layout,
    visibleWidgets: layout.widgets.filter((w) => w.visible),
    updateLayout,
    moveWidget,
    resizeWidget,
    toggleWidget,
    addWidget,
    removeWidget,
    resetLayout,
  };
}
