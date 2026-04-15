"use client";

import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { schedulerMetricsApi, metricsApi } from "@/lib/api/metrics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  LayoutGrid,
  Plus,
  X,
  GripVertical,
  DollarSign,
  Mail,
  CheckSquare,
  TrendingUp,
  Users,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";

// ── Widget definitions ────────────────────────────────────────────────────────

type WidgetType =
  | "revenue"
  | "emails_day"
  | "tasks_completed"
  | "deals_won"
  | "active_users"
  | "tasks_pending"
  | "tasks_blocked";

interface WidgetConfig {
  id: string;
  type: WidgetType;
  col: number; // 0-based column in a 3-col grid
}

const WIDGET_CATALOG: Array<{
  type: WidgetType;
  label: string;
  icon: React.ElementType;
  color: string;
}> = [
  {
    type: "revenue",
    label: "Revenue",
    icon: DollarSign,
    color: "text-green-500",
  },
  {
    type: "emails_day",
    label: "Emails / jour",
    icon: Mail,
    color: "text-blue-500",
  },
  {
    type: "tasks_completed",
    label: "Tâches terminées",
    icon: CheckSquare,
    color: "text-emerald-500",
  },
  {
    type: "tasks_pending",
    label: "Tâches en attente",
    icon: BarChart3,
    color: "text-amber-500",
  },
  {
    type: "tasks_blocked",
    label: "Tâches bloquées",
    icon: BarChart3,
    color: "text-red-500",
  },
  {
    type: "deals_won",
    label: "Deals gagnés",
    icon: TrendingUp,
    color: "text-violet-500",
  },
  {
    type: "active_users",
    label: "Utilisateurs actifs",
    icon: Users,
    color: "text-sky-500",
  },
];

const LS_KEY = "analytics_custom_layout";

function loadLayout(): WidgetConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : defaultLayout();
  } catch {
    return defaultLayout();
  }
}

function defaultLayout(): WidgetConfig[] {
  return [
    { id: "1", type: "tasks_completed", col: 0 },
    { id: "2", type: "tasks_pending", col: 1 },
    { id: "3", type: "tasks_blocked", col: 2 },
    { id: "4", type: "active_users", col: 0 },
  ];
}

function saveLayout(layout: WidgetConfig[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(layout));
}

// ── Individual widget ─────────────────────────────────────────────────────────

function WidgetCard({
  config,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  config: WidgetConfig;
  onRemove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (id: string) => void;
}) {
  const def = WIDGET_CATALOG.find((w) => w.type === config.type)!;
  const Icon = def.icon;

  // Fetch data depending on widget type
  const { data: workload } = useQuery({
    queryKey: ["metrics", "workload"],
    queryFn: () => schedulerMetricsApi.getWorkload(),
    retry: 1,
    staleTime: 30_000,
  });

  const { data: adminOverview } = useQuery({
    queryKey: ["metrics", "admin-overview"],
    queryFn: () => metricsApi.analyticsOverview().then((r) => r.data),
    retry: 1,
    staleTime: 60_000,
  });

  const getValue = (): string | number => {
    switch (config.type) {
      case "tasks_completed":
        return workload?.completed ?? "—";
      case "tasks_pending":
        return workload?.pending ?? "—";
      case "tasks_blocked":
        return workload?.blocked ?? "—";
      case "active_users":
        return adminOverview?.active_today ?? "—";
      case "revenue":
        return "—"; // NOTE: CRM revenue API integration tracked in backlog
      case "emails_day":
        return "—"; // NOTE: mail service stats integration tracked in backlog
      case "deals_won":
        return "—"; // NOTE: CRM deals API integration tracked in backlog
      default:
        return "—";
    }
  };

  // Generate mini sparkline data
  const sparkData = Array.from({ length: 7 }, (_, i) => ({
    day: i,
    v: Math.round(Math.random() * 40 + 10),
  }));

  return (
    <Card
      draggable
      onDragStart={() => onDragStart(config.id)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(config.id)}
      className="relative group cursor-grab active:cursor-grabbing"
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            <Icon className={`h-4 w-4 ${def.color}`} />
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {def.label}
            </CardTitle>
          </div>
          <button
            onClick={() => onRemove(config.id)}
            className="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        <div className={`text-2xl font-bold ${def.color}`}>{getValue()}</div>
        <ResponsiveContainer width="100%" height={40}>
          <LineChart data={sparkData}>
            <Line
              type="monotone"
              dataKey="v"
              stroke="currentColor"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CustomAnalyticsDashboard() {
  usePageTitle("Dashboard BI personnalisé");
  const [layout, setLayout] = useState<WidgetConfig[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  const persistLayout = useCallback((next: WidgetConfig[]) => {
    setLayout(next);
    saveLayout(next);
  }, []);

  const addWidget = useCallback(
    (type: WidgetType) => {
      const newWidget: WidgetConfig = {
        id: Date.now().toString(),
        type,
        col: layout.length % 3,
      };
      persistLayout([...layout, newWidget]);
      setShowPicker(false);
      toast.success(
        `Widget "${WIDGET_CATALOG.find((w) => w.type === type)?.label}" ajouté`,
      );
    },
    [layout, persistLayout],
  );

  const removeWidget = useCallback(
    (id: string) => {
      persistLayout(layout.filter((w) => w.id !== id));
      toast.success("Widget supprimé");
    },
    [layout, persistLayout],
  );

  const handleDragStart = useCallback((id: string) => {
    setDragId(id);
  }, []);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragId || dragId === targetId) {
        setDragId(null);
        return;
      }
      const from = layout.findIndex((w) => w.id === dragId);
      const to = layout.findIndex((w) => w.id === targetId);
      if (from === -1 || to === -1) {
        setDragId(null);
        return;
      }
      const next = [...layout];
      [next[from], next[to]] = [next[to], next[from]];
      persistLayout(next);
      setDragId(null);
    },
    [dragId, layout, persistLayout],
  );

  const handleReset = () => {
    persistLayout(defaultLayout());
    toast.success("Mise en page réinitialisée");
  };

  return (
    <AppLayout>
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Dashboard BI personnalisé</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Glissez-déposez les widgets, ajoutez ou supprimez des indicateurs.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Réinitialiser
            </Button>
            <Button
              size="sm"
              onClick={() => setShowPicker((v) => !v)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter un widget
            </Button>
          </div>
        </div>

        {/* Widget picker */}
        {showPicker && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              Choisir un widget
            </h3>
            <div className="flex flex-wrap gap-2">
              {WIDGET_CATALOG.map((w) => {
                const Icon = w.icon;
                const alreadyAdded = layout.some((l) => l.type === w.type);
                return (
                  <Button
                    key={w.type}
                    variant={alreadyAdded ? "secondary" : "outline"}
                    size="sm"
                    disabled={alreadyAdded}
                    onClick={() => addWidget(w.type)}
                    className="gap-1.5"
                  >
                    <Icon className={`h-3.5 w-3.5 ${w.color}`} />
                    {w.label}
                    {alreadyAdded && (
                      <Badge variant="secondary" className="text-xs ml-1">
                        Ajouté
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Widget grid */}
        {layout.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Aucun widget — ajoutez des indicateurs pour commencer
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {layout.map((widget) => (
              <WidgetCard
                key={widget.id}
                config={widget}
                onRemove={removeWidget}
                onDragStart={handleDragStart}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center pt-2">
          La disposition est sauvegardée automatiquement dans votre navigateur.
        </p>
      </div>
    </AppLayout>
  );
}
