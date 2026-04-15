"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { GanttChart } from "@/components/projects/gantt-chart";
import { usePageTitle } from "@/hooks/use-page-title";
import { BarChart2 } from "lucide-react";

export default function GanttPage() {
  usePageTitle("Gantt — Projets");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Gantt
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Planification visuelle des tâches sur une timeline.
            </p>
          </div>
        </div>

        <div className="h-[600px]">
          <GanttChart tasks={[]} />
        </div>
      </div>
    </AppLayout>
  );
}
