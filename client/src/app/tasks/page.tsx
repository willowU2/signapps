"use client";

import React, { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Plus,
  Download,
  Upload,
  MoreVertical,
  ExternalLink,
  X,
  Settings,
  FolderPlus,
  Sparkles,
  Loader2,
  CheckSquare,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskTree } from "@/components/tasks/TaskTree";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { CustomKanbanBoard } from "@/components/tasks/CustomKanbanBoard";
import { TasksHeader } from "@/components/tasks/tasks-header";
import { ExportDialog } from "@/components/calendar/ExportDialog";
import { ImportDialog } from "@/components/calendar/ImportDialog";
import { useEntityStore } from "@/stores/entity-hub-store";
import { entityHubApi } from "@/lib/api/entityHub";
import { AppLayout } from "@/components/layout/app-layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function TasksPage() {
  usePageTitle("Tâches");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<string | undefined>();
  const [treeKey, setTreeKey] = useState(0);
  const [viewMode, setViewMode] = useState<
    "list" | "board" | "custom-board" | "my-tasks"
  >("list");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [myTasksLoading, setMyTasksLoading] = useState(false);

  // Unified Entity Hub sync
  const { projects, fetchTasks, fetchProjects, isLoading } = useEntityStore();

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      await Promise.all([fetchTasks(), fetchProjects()]);
    } catch {
      setLoadError(
        "Impossible de charger les tâches. Vérifiez que le serveur est démarré.",
      );
    }
  }, [fetchTasks, fetchProjects]);

  useEffect(() => {
    load();
  }, [load]);

  // Load projects on mount
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (viewMode === "my-tasks") {
      setMyTasksLoading(true);
      entityHubApi
        .myTasks()
        .then((res) => setMyTasks(Array.isArray(res.data) ? res.data : []))
        .catch(() => setMyTasks([]))
        .finally(() => setMyTasksLoading(false));
    }
  }, [viewMode]);

  const handleAddTask = () => {
    setParentTaskId(undefined);
    setFormOpen(true);
  };

  const handleAddChild = (parentId: string) => {
    setParentTaskId(parentId);
    setFormOpen(true);
  };

  const handleTaskCreated = () => {
    // Reload tree
    setTreeKey((prev) => prev + 1);
  };

  return (
    <AppLayout>
      <div
        data-testid="tasks-root"
        className="flex h-[calc(100vh-8rem)] w-full p-4 md:p-6 lg:p-8"
      >
        <div className="w-full bg-card/40 backdrop-blur-3xl border border-border/50 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex flex-col overflow-hidden relative ring-1 ring-white/10">
          <TasksHeader
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onExportTasks={() => setExportDialogOpen(true)}
            onImportTasks={() => setImportDialogOpen(true)}
            onAddTask={handleAddTask}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {/* Content Line Items */}
          <div className="flex-1 overflow-y-auto w-full relative group">
            {/* Subtle background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-primary/5 blur-[100px] rounded-full pointer-events-none transition-opacity duration-1000 opacity-50 group-hover:opacity-100" />

            {loadError ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 space-y-4">
                <X className="w-10 h-10 text-destructive/40" />
                <p className="text-base font-medium text-muted-foreground">
                  {loadError}
                </p>
                <Button variant="outline" size="sm" onClick={load}>
                  Réessayer
                </Button>
              </div>
            ) : isLoading && projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-medium animate-pulse">
                  Chargement de votre espace de travail...
                </p>
              </div>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={FolderPlus}
                context="empty"
                title="Aucun projet"
                description="Créez un projet dans le Hub pour commencer à gérer vos tâches."
                actionLabel="Aller dans le Hub"
                onAction={() => {
                  window.location.href = "/projects";
                }}
              />
            ) : viewMode === "my-tasks" ? (
              <div
                data-testid="my-tasks-root"
                className="pb-32 h-full z-10 relative p-4"
              >
                {myTasksLoading ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Chargement de vos tâches...</span>
                  </div>
                ) : myTasks.length === 0 ? (
                  <EmptyState
                    icon={CheckSquare}
                    context="empty"
                    title="Aucune tâche assignée"
                    description="Vous n'avez aucune tâche assignée pour le moment."
                  />
                ) : (
                  <ul className="space-y-2">
                    {myTasks.map((task: any) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
                      >
                        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.title}</p>
                          {task.due_date && (
                            <p className="text-xs text-muted-foreground">
                              Échéance :{" "}
                              {new Date(task.due_date).toLocaleDateString(
                                "fr-FR",
                              )}
                            </p>
                          )}
                        </div>
                        {task.assignee_id && (
                          <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                            {task.assignee_name ?? task.assignee_id.slice(0, 8)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              selectedProjectId && (
                <div
                  data-testid="task-tree-root"
                  className="pb-32 h-full z-10 relative"
                >
                  {viewMode === "list" ? (
                    <TaskTree
                      key={treeKey}
                      projectId={selectedProjectId}
                      onAddChild={handleAddChild}
                    />
                  ) : viewMode === "board" ? (
                    <TaskBoard
                      key={`board-${treeKey}`}
                      projectId={selectedProjectId}
                    />
                  ) : (
                    // IDEA-130: Custom Kanban with user-defined columns
                    <CustomKanbanBoard
                      key={`custom-board-${treeKey}`}
                      projectId={selectedProjectId}
                    />
                  )}
                </div>
              )
            )}
          </div>
        </div>

        {/* Dialogs */}
        <TaskForm
          open={formOpen}
          onOpenChange={setFormOpen}
          projectId={selectedProjectId || projects[0]?.id || ""}
          parentTaskId={parentTaskId}
          onTaskCreated={handleTaskCreated}
        />

        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          calendarId={selectedProjectId}
          calendarName={
            projects.find((c) => c.id === selectedProjectId)?.name || "Tasks"
          }
        />

        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          calendarId={selectedProjectId}
          onImportComplete={() => {
            setTreeKey((prev) => prev + 1);
          }}
        />
      </div>
    </AppLayout>
  );
}
