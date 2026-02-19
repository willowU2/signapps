"use client";

import React, { useEffect, useState } from "react";
import { Plus, Download, Upload, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskTree } from "@/components/tasks/TaskTree";
import { TaskForm } from "@/components/tasks/TaskForm";
import { ExportDialog } from "@/components/calendar/ExportDialog";
import { ImportDialog } from "@/components/calendar/ImportDialog";
import { calendarApi } from "@/lib/calendar-api";
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
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Tasks</h1>
            <p className="text-muted-foreground mt-1">
              Organize your work with hierarchical tasks
            </p>
          </div>

          <div className="flex gap-2">
            {/* Export/Import menu */}
            {selectedCalendarId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="gap-2">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setExportDialogOpen(true)} className="gap-2">
                    <Download className="h-4 w-4" />
                    <span>Export Tasks</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setImportDialogOpen(true)} className="gap-2">
                    <Upload className="h-4 w-4" />
                    <span>Import Tasks</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleAddTask} className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span>New Task</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* New Task button (primary) */}
            <Button onClick={handleAddTask} className="gap-2">
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">
            Loading...
          </div>
        ) : calendars.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p>No calendars found. Create a calendar first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar */}
            <div className="col-span-3">
              <div className="space-y-2">
                <h2 className="font-semibold text-lg mb-4">Calendars</h2>
                {calendars.map((calendar) => (
                  <div
                    key={calendar.id}
                    onClick={() => setSelectedCalendarId(calendar.id)}
                    className={`p-3 rounded-lg cursor-pointer border-2 transition ${
                      selectedCalendarId === calendar.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: calendar.color }}
                      />
                      <p className="font-medium text-sm">{calendar.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Task tree */}
            <div className="col-span-9">
              {selectedCalendarId && (
                <div className="bg-white rounded-lg border p-4">
                  <TaskTree
                    key={treeKey}
                    calendarId={selectedCalendarId}
                    onAddChild={handleAddChild}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Task form dialog */}
        <TaskForm
          open={formOpen}
          onOpenChange={setFormOpen}
          calendarId={selectedCalendarId || calendars[0]?.id || ""}
          parentTaskId={parentTaskId}
          onTaskCreated={handleTaskCreated}
        />

        {/* Export dialog */}
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          calendarId={selectedCalendarId}
          calendarName={
            calendars.find((c) => c.id === selectedCalendarId)?.name || "Tasks"
          }
        />

        {/* Import dialog */}
        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          calendarId={selectedCalendarId}
          onImportComplete={() => {
            // Refresh task tree after import
            setTreeKey((prev) => prev + 1);
          }}
        />
      </div>
    </AppLayout>
  );
}
