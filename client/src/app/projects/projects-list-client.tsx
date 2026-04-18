"use client";

import React, { useState, useEffect } from "react";
import type { ProjectsListResponse } from "@/lib/server/projects";
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
import { FolderKanban, User } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import { entityHubApi } from "@/lib/api/entityHub";
import { Badge } from "@/components/ui/badge";

type ProjectTab =
  | "gantt"
  | "milestones"
  | "time"
  | "resources"
  | "spreadsheet"
  | "dependencies"
  | "health"
  | "risks"
  | "sprint"
  | "templates";

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

interface ProjectsListClientProps {
  /**
   * Server-prefetched projects list used to seed the "My projects" panel
   * and avoid a client round-trip on first toggle.
   */
  initialList: ProjectsListResponse;
}

export function ProjectsListClient({ initialList }: ProjectsListClientProps) {
  usePageTitle("Projets");
  const [activeTab, setActiveTab] = useState<ProjectTab>("gantt");
  const [myProjectsMode, setMyProjectsMode] = useState(false);
  // Seed from the server-prefetched list so the first toggle shows the
  // projects immediately instead of waiting on a client round-trip.
  const [myProjects, setMyProjects] = useState<any[]>(
    initialList.projects ?? [],
  );
  const [myProjectsLoading, setMyProjectsLoading] = useState(false);

  useEffect(() => {
    if (myProjectsMode) {
      setMyProjectsLoading(true);
      entityHubApi
        .myProjects()
        .then((res) => setMyProjects(Array.isArray(res.data) ? res.data : []))
        .catch(() => setMyProjects([]))
        .finally(() => setMyProjectsLoading(false));
    }
  }, [myProjectsMode]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Projets
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Gérez vos projets, plannings, ressources et risques.
              </p>
            </div>
          </div>
          <Button
            data-testid="projects-my-projects-toggle"
            variant={myProjectsMode ? "default" : "outline"}
            size="sm"
            onClick={() => setMyProjectsMode((prev) => !prev)}
            className="shrink-0 gap-2"
          >
            <User className="h-4 w-4" />
            Mes projets
          </Button>
        </div>

        {/* My Projects Panel */}
        {myProjectsMode && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Mes projets
            </h2>
            {myProjectsLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : myProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun projet assigné.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myProjects.map((project: any) => (
                  <div
                    key={project.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold truncate">{project.name}</p>
                      {project.status && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {project.status}
                        </Badge>
                      )}
                    </div>
                    {project.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Échéance :{" "}
                        {new Date(project.due_date).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                    {project.progress_percent !== undefined && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progression</span>
                          <span>{project.progress_percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${Math.min(100, project.progress_percent)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ProjectTab)}
        >
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-auto">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="text-xs sm:text-sm whitespace-nowrap"
                >
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
