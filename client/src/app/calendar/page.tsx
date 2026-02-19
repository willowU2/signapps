"use client";

import React, { useEffect, useState } from "react";
import { useCalendarStore } from "@/stores/calendar-store";
import { calendarApi } from "@/lib/calendar-api";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { EventForm } from "@/components/calendar/EventForm";
import { ExportDialog } from "@/components/calendar/ExportDialog";
import { ImportDialog } from "@/components/calendar/ImportDialog";
import { ShareDialog } from "@/components/calendar/ShareDialog";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload, MoreVertical, Share2 } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function CalendarPage() {
  const {
    calendars,
    setCalendars,
    selectedEventId,
    setSelectedCalendars,
  } = useCalendarStore();

  const [isLoading, setIsLoading] = useState(true);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);

  // Load calendars on mount
  useEffect(() => {
    const loadCalendars = async () => {
      try {
        setIsLoading(true);
        const response = await calendarApi.listCalendars();
        setCalendars(response.data);

        // Select first calendar by default
        if (response.data.length > 0) {
          setSelectedCalendarId(response.data[0].id);
          setSelectedCalendars([response.data[0]]);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };

    loadCalendars();
  }, [setCalendars, setSelectedCalendars]);

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Calendar</h1>
            <p className="text-muted-foreground mt-1">
              Manage your schedule and events
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
                  <DropdownMenuItem onClick={() => setShareDialogOpen(true)} className="gap-2">
                    <Share2 className="h-4 w-4" />
                    <span>Share Calendar</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setExportDialogOpen(true)} className="gap-2">
                    <Download className="h-4 w-4" />
                    <span>Export Calendar</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setImportDialogOpen(true)} className="gap-2">
                    <Upload className="h-4 w-4" />
                    <span>Import Calendar</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setEventFormOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span>New Event</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* New Event button (primary) */}
            <Button
              onClick={() => setEventFormOpen(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Event
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">
            Loading calendars...
          </div>
        ) : calendars.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="mb-4">No calendars yet. Create your first calendar to get started.</p>
            <Button onClick={() => setEventFormOpen(true)}>
              Create Calendar
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar */}
            <div className="col-span-3">
              <div className="space-y-4">
                <h2 className="font-semibold text-lg">My Calendars</h2>
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
                    <p className="text-xs text-muted-foreground">
                      {calendar.timezone}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Main calendar view */}
            <div className="col-span-9">
              {selectedCalendarId && (
                <MonthCalendar selectedCalendarId={selectedCalendarId} />
              )}
            </div>
          </div>
        )}

        {/* Event form dialog */}
        <EventForm
          open={eventFormOpen}
          onOpenChange={setEventFormOpen}
          calendarId={selectedCalendarId || calendars[0]?.id || ""}
        />

        {/* Export dialog */}
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          calendarId={selectedCalendarId}
          calendarName={
            calendars.find((c) => c.id === selectedCalendarId)?.name || "Calendar"
          }
        />

        {/* Import dialog */}
        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          calendarId={selectedCalendarId}
          onImportComplete={() => {
            // Refresh calendar data after import
            setEventFormOpen(false);
          }}
        />

        {/* Share dialog */}
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          calendarId={selectedCalendarId}
          calendarName={
            calendars.find((c) => c.id === selectedCalendarId)?.name || "Calendar"
          }
        />
      </div>
    </AppLayout>
  );
}
