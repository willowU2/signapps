"use client";

import React, { useEffect, useState } from "react";
import { Plus, Download, Upload, MoreVertical, ExternalLink, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskTree } from "@/components/tasks/TaskTree";
import { TaskForm } from "@/components/tasks/TaskForm";
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

  // Unified Entity Hub sync
  const { projects, fetchTasks, fetchProjects, isLoading } = useEntityStore();

  useEffect(() => {
    fetchTasks();
    fetchProjects();
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
      <div className="flex h-[calc(100vh-8rem)] w-full bg-background p-4 pl-0">
        <div className="w-full glass-panel border border-border/50 rounded-2xl shadow-premium flex flex-col overflow-hidden relative">
          
          <TasksHeader 
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onExportTasks={() => setExportDialogOpen(true)}
            onImportTasks={() => setImportDialogOpen(true)}
            onAddTask={handleAddTask}
          />

          {/* Content Line Items */}
          <div className="flex-1 overflow-y-auto w-full">
            {isLoading && projects.length === 0 ? (
              <div className="text-center text-[#5f6368] py-12 text-sm">
                Chargement...
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center text-[#5f6368] py-12 text-sm">
                Aucun projet trouvé. Veuillez d'abord créer un projet dans le Hub.
              </div>
            ) : selectedProjectId && (
                <div className="pb-20">
                    <TaskTree
                        key={treeKey}
                        projectId={selectedProjectId}
                        onAddChild={handleAddChild}
                    />
                </div>
            )}
          </div>

          {/* New Task Check FAB Button Optional Placeholder */}
           <div className="absolute right-6 bottom-6 hidden shadow-lg rounded-full flex items-center justify-center cursor-pointer hover:shadow-xl transition-shadow bg-blue-600 text-white w-14 h-14">
               <Plus className="h-8 w-8" />
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
