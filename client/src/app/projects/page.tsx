"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GanttChart } from "@/components/projects/gantt-chart";
import { Milestones } from "@/components/projects/milestones";
import { TimeTracker } from "@/components/projects/time-tracker";
import { ResourceAllocation } from "@/components/projects/resource-allocation";
import { TaskSpreadsheet } from "@/components/projects/task-spreadsheet";
import { TaskDependencies } from "@/components/projects/task-dependencies";
import { HealthReport } from "@/components/projects/health-report";
import { RiskRegister } from "@/components/projects/risk-register";
import { SprintBoard } from "@/components/projects/sprint-board";
import { ProjectTemplates } from "@/components/projects/project-templates";
import { FolderKanban } from "lucide-react";

type ProjectTab =
  | "gantt" | "milestones" | "time" | "resources" | "spreadsheet"
  | "dependencies" | "health" | "risks" | "sprint" | "templates";

const TABS: { id: ProjectTab; label: string }[] = [
  { id: "gantt", label: "Gantt" },
  { id: "milestones", label: "Jalons" },
  { id: "sprint", label: "Sprint" },
  { id: "spreadsheet", label: "Tableau" },
  { id: "dependencies", label: "Dépendances" },
  { id: "time", label: "Temps" },
  { id: "resources", label: "Ressources" },
  { id: "health", label: "Santé" },
  { id: "risks", label: "Risques" },
  { id: "templates", label: "Templates" },
];

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<ProjectTab>("gantt");

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <FolderKanban className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Projets
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Gérez vos projets, plannings, ressources et risques.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProjectTab)}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-auto">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm whitespace-nowrap">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="gantt" className="mt-4">
            <div className="h-[500px]">
              <GanttChart tasks={[]} />
            </div>
          </TabsContent>

          <TabsContent value="milestones" className="mt-4">
            <Milestones />
          </TabsContent>

          <TabsContent value="sprint" className="mt-4">
            <SprintBoard />
          </TabsContent>

          <TabsContent value="spreadsheet" className="mt-4">
            <TaskSpreadsheet />
          </TabsContent>

          <TabsContent value="dependencies" className="mt-4">
            <TaskDependencies tasks={[]} />
          </TabsContent>

          <TabsContent value="time" className="mt-4">
            <TimeTracker />
          </TabsContent>

          <TabsContent value="resources" className="mt-4">
            <ResourceAllocation />
          </TabsContent>

          <TabsContent value="health" className="mt-4">
            <HealthReport />
          </TabsContent>

          <TabsContent value="risks" className="mt-4">
            <RiskRegister />
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <ProjectTemplates />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
