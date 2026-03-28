"use client";

import React, { useEffect, useState } from "react";
import { Plus, Download, Upload, MoreVertical, ExternalLink, X, Settings, FolderPlus, Sparkles, Loader2 } from "lucide-react";
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
import { AppLayout } from "@/components/layout/app-layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function TasksPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<string | undefined>();
  const [treeKey, setTreeKey] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'custom-board'>('list');

  // Unified Entity Hub sync
  const { projects, fetchTasks, fetchProjects, isLoading } = useEntityStore();

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([fetchTasks(), fetchProjects()]);
      } catch {
        toast.error('Failed to load tasks');
      }
    };
    load();
  }, [fetchTasks, fetchProjects]);

  // Load projects on mount
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

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
      <div className="flex h-[calc(100vh-8rem)] w-full p-4 md:p-6 lg:p-8">
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

            {isLoading && projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm font-medium animate-pulse">Chargement de votre espace de travail...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-4 space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-inner">
                    <FolderPlus className="h-10 w-10 text-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold tracking-tight">Où est passé votre projet ?</h3>
                  <p className="text-muted-foreground text-[15px] leading-relaxed">
                    Il semble que vous n'ayez encore aucun projet. Créez-en un dans le Hub pour débloquer toute la puissance de la gestion des tâches intelligente.
                  </p>
                </div>
                <Button onClick={() => window.location.href='/projects'} size="lg" className="rounded-full shadow-lg hover:shadow-xl bg-primary text-primary-foreground font-medium h-12 px-8 transition-all hover:-translate-y-1 mt-2">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Aller dans le Hub
                </Button>
              </div>
            ) : selectedProjectId && (
                <div className="pb-32 h-full z-10 relative">
                    {viewMode === 'list' ? (
                      <TaskTree
                          key={treeKey}
                          projectId={selectedProjectId}
                          onAddChild={handleAddChild}
                      />
                    ) : viewMode === 'board' ? (
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
