"use client";

import React, { useEffect, useState } from "react";
import { Plus, Download, Upload, MoreVertical, ExternalLink, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskTree } from "@/components/tasks/TaskTree";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TasksHeader } from "@/components/tasks/tasks-header";
import { ExportDialog } from "@/components/calendar/ExportDialog";
import { ImportDialog } from "@/components/calendar/ImportDialog";
import { calendarApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/app-layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function TasksPage() {
  const [calendars, setCalendars] = useState<any[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parentTaskId, setParentTaskId] = useState<string | undefined>();
  const [treeKey, setTreeKey] = useState(0);

  // Load calendars on mount
  useEffect(() => {
    const loadCalendars = async () => {
      try {
        setIsLoading(true);
        const response = await calendarApi.listCalendars();
        setCalendars(response.data);

        // Select first calendar
        if (response.data.length > 0) {
          setSelectedCalendarId(response.data[0].id);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };

    loadCalendars();
  }, []);

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
      <div className="flex justify-center h-[calc(100vh-8rem)] w-full py-6 bg-background">
        <div className="w-full max-w-md bg-white border rounded-[24px] shadow-sm flex flex-col overflow-hidden relative">
          
          <TasksHeader 
            calendars={calendars}
            selectedCalendarId={selectedCalendarId}
            onSelectCalendar={setSelectedCalendarId}
            onExportTasks={() => setExportDialogOpen(true)}
            onImportTasks={() => setImportDialogOpen(true)}
            onAddTask={handleAddTask}
          />

          {/* Content Line Items */}
          <div className="flex-1 overflow-y-auto w-full">
            {isLoading ? (
              <div className="text-center text-[#5f6368] py-12 text-sm">
                Chargement...
              </div>
            ) : calendars.length === 0 ? (
              <div className="text-center text-[#5f6368] py-12 text-sm">
                Aucune liste de tâches trouvée.
              </div>
            ) : selectedCalendarId && (
                <div className="pb-20">
                    <TaskTree
                        key={treeKey}
                        calendarId={selectedCalendarId}
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
          calendarId={selectedCalendarId || calendars[0]?.id || ""}
          parentTaskId={parentTaskId}
          onTaskCreated={handleTaskCreated}
        />

        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          calendarId={selectedCalendarId}
          calendarName={
            calendars.find((c) => c.id === selectedCalendarId)?.name || "Tasks"
          }
        />

        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          calendarId={selectedCalendarId}
          onImportComplete={() => {
            setTreeKey((prev) => prev + 1);
          }}
        />
      </div>
    </AppLayout>
  );
}
