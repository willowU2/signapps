"use client";

import { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  Pencil,
  Plus,
  RotateCcw,
  Printer,
  Mail,
  CalendarDays,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDashboardData,
  useDashboardSummary,
  useDashboardBackendLayout,
} from "@/hooks/use-dashboard";
import { useDashboardStore, getDefaultLayout } from "@/stores/dashboard-store";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { AddWidgetDialog } from "@/components/dashboard/add-widget-dialog";
import { useAuthStore } from "@/lib/store";
import { resetAllBreakers } from "@/lib/circuit-breaker";
import { cn } from "@/lib/utils";

function getRoleLabel(role?: number): string {
  if (role === undefined) return "Utilisateur";
  if (role >= 3) return "Super Admin";
  if (role >= 2) return "Admin";
  if (role >= 1) return "Utilisateur";
  return "Invité";
}

function buildPrintHeader(): HTMLDivElement {
  const header = document.createElement("div");
  header.className = "print-header";
  header.id = "dashboard-print-header";
  const h1 = document.createElement("h1");
  h1.textContent = "SignApps Platform — Tableau de bord";
  const p = document.createElement("p");
  p.textContent = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  header.appendChild(h1);
  header.appendChild(p);
  header.style.display = "none";
  return header;
}

export default function DashboardPage() {
  usePageTitle("Tableau de bord");
  const queryClient = useQueryClient();
  const { isFetching: refreshing, isLoading: loading } = useDashboardData();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { backendLayout, isLayoutLoading } = useDashboardBackendLayout();
  const {
    editMode,
    setEditMode,
    resetLayout,
    widgets,
    setWidgets,
    hydrateFromBackend,
  } = useDashboardStore();
  const { user } = useAuthStore();
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load layout from backend on first visit, fallback to role-based default
  useEffect(() => {
    if (initialized || isLayoutLoading) return;

    // If backend has a saved layout, hydrate from it
    if (backendLayout?.widgets && backendLayout.widgets.length > 0) {
      hydrateFromBackend(backendLayout.widgets);
      setInitialized(true);
      return;
    }

    // Otherwise, initialize from role-based defaults if store is empty
    if (user?.role !== undefined && widgets.length === 0) {
      const defaultLayout = getDefaultLayout(user.role);
      setWidgets(defaultLayout);
    }
    setInitialized(true);
  }, [
    user?.role,
    widgets.length,
    initialized,
    setWidgets,
    hydrateFromBackend,
    backendLayout,
    isLayoutLoading,
  ]);

  const handlePrint = () => {
    const header = buildPrintHeader();
    const main = document.getElementById("main-content");
    if (main) main.prepend(header);
    window.print();
    setTimeout(() => {
      document.getElementById("dashboard-print-header")?.remove();
    }, 500);
  };

  // KPI summary cards configuration
  const kpiCards = [
    {
      label: "Emails non lus",
      value: summary?.unread_emails ?? 0,
      icon: Mail,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      href: "/mail",
    },
    {
      label: "Taches du jour",
      value: summary?.tasks_due_today ?? 0,
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      href: "/tasks",
    },
    {
      label: "Evenements a venir",
      value: summary?.upcoming_events ?? 0,
      icon: CalendarDays,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      href: "/cal",
    },
    {
      label: "Fichiers recents",
      value: summary?.recent_files ?? 0,
      icon: FileText,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      href: "/drive",
    },
  ];

  if ((loading || isLayoutLoading) && !initialized) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          {/* KPI skeleton */}
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-2xl" />
          <div className="grid gap-6 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Tableau de bord</h2>
            <p className="text-sm text-muted-foreground">
              Bienvenue, voici l&apos;état actuel de votre workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Role indicator */}
            <Badge variant="outline" className="text-xs">
              {getRoleLabel(user?.role)}
            </Badge>

            {editMode && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddWidgetOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" /> Ajouter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetLayout(user?.role)}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
                </Button>
              </>
            )}
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editMode ? "Terminer" : "Personnaliser"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetAllBreakers();
                queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                queryClient.invalidateQueries({ queryKey: ["service-health"] });
              }}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
              />{" "}
              Actualiser
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="no-print"
            >
              <Printer className="mr-2 h-4 w-4" /> Imprimer
            </Button>
          </div>
        </header>

        {/* KPI Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {kpiCards.map((kpi) => (
            <Card
              key={kpi.label}
              className="cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = kpi.href;
                }
              }}
            >
              <CardContent className="flex items-center gap-4 p-4">
                {summaryLoading ? (
                  <Skeleton className="h-12 w-full rounded-lg" />
                ) : (
                  <>
                    <div className={cn("rounded-lg p-2.5", kpi.bgColor)}>
                      <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums">
                        {kpi.value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {kpi.label}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Widget Grid */}
        <WidgetGrid />

        <AddWidgetDialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen} />
      </div>
    </AppLayout>
  );
}
