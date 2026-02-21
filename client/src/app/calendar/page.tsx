"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useCalendarStore } from "@/stores/calendar-store";
import { calendarApi } from "@/lib/api";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { CalendarView } from "@/components/calendar/CalendarView";
import { EventForm } from "@/components/calendar/EventForm";
import { ExportDialog } from "@/components/calendar/ExportDialog";
import { ImportDialog } from "@/components/calendar/ImportDialog";
import { ShareDialog } from "@/components/calendar/ShareDialog";
import { TimezoneSelector } from "@/components/calendar/TimezoneSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Download, Upload, MoreVertical, Share2, Zap } from "lucide-react";
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
    events,
    selectedEventId,
    selectEvent,
    setSelectedCalendars,
    viewMode,
    setViewMode,
    timezones,
    setTimezones,
  } = useCalendarStore();

  const selectedEvent = useMemo(() =>
    events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  );

  useEffect(() => {
    if (selectedEventId) {
      setEventFormOpen(true);
    }
  }, [selectedEventId]);

  const [isLoading, setIsLoading] = useState(true);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);

  // Quick Add State
  const [quickAddText, setQuickAddText] = useState("");
  const [quickAddDefaultStart, setQuickAddDefaultStart] = useState<Date | undefined>(undefined);

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
        } else {
          // Mock data for UI demonstration purposes
          const mockCalendar = {
            id: "cal_1",
            name: "My Calendar",
            color: "#3b82f6",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            is_default: true,
            user_id: "user_1",
            owner_id: "user_1",
            is_shared: false,
            is_public: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          setCalendars([mockCalendar]);
          setSelectedCalendarId(mockCalendar.id);
          setSelectedCalendars([mockCalendar]);
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

            {/* Quick Add Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!quickAddText.trim()) return;

                // Super basic NLP for demo:
                let defaultStart = new Date();
                const lowerText = quickAddText.toLowerCase();

                if (lowerText.includes("tomorrow")) {
                  defaultStart.setDate(defaultStart.getDate() + 1);
                } else if (lowerText.includes("next week")) {
                  defaultStart.setDate(defaultStart.getDate() + 7);
                }

                setQuickAddDefaultStart(defaultStart);
                setEventFormOpen(true);
                setQuickAddText("");
              }}
              className="relative hidden sm:block w-[280px]"
            >
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Zap className="h-4 w-4 text-purple-500" />
              </div>
              <Input
                type="text"
                placeholder="Lunch with Sarah tomorrow..."
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                className="pl-9 bg-muted/20 border-border/50 focus-visible:ring-purple-500/30 transition-all rounded-full h-9 text-sm"
              />
            </form>

            {/* View Switcher */}
            <div className="flex bg-muted/20 p-1 rounded-md border text-sm items-center">
              <button
                className={`px-3 py-1.5 rounded-sm transition-all ${viewMode === "month" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                onClick={() => setViewMode("month")}
              >
                Month
              </button>
              <button
                className={`px-3 py-1.5 rounded-sm transition-all ${viewMode === "week" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                onClick={() => setViewMode("week")}
              >
                Week
              </button>
              <button
                className={`px-3 py-1.5 rounded-sm transition-all ${viewMode === "day" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                onClick={() => setViewMode("day")}
              >
                Day
              </button>
            </div>

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
                    className={`p-3 rounded-lg cursor-pointer border-2 transition ${selectedCalendarId === calendar.id
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

                {/* Timezones (Cron Style) */}
                <div className="pt-4 mt-6 border-t border-border/50 hidden lg:block">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="font-semibold text-sm">Timezones</h3>
                  </div>
                  <div className="space-y-4">
                    {timezones.map((tz, index) => (
                      <div key={index} className="flex gap-2 items-start relative">
                        <div className="flex-1">
                          <TimezoneSelector
                            value={tz}
                            onChange={(newTz) => {
                              const newTimezones = [...timezones];
                              newTimezones[index] = newTz;
                              setTimezones(newTimezones);
                            }}
                          />
                        </div>
                        {index > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 absolute top-7 right-0"
                            onClick={() => {
                              const newTimezones = timezones.filter((_, i) => i !== index);
                              setTimezones(newTimezones);
                            }}
                          >
                            <Plus className="h-4 w-4 rotate-45" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {timezones.length < 3 && (
                      <Button variant="outline" size="sm" className="w-full text-xs shadow-sm" onClick={() => {
                        setTimezones([...timezones, "UTC"]);
                      }}>
                        <Plus className="w-3 h-3 mr-2" /> Add Timezone
                      </Button>
                    )}
                  </div>
                </div>

                {/* Notion/Cron Style Mini Calendar Placeholder */}
                <div className="pt-4 mt-6 border-t border-border/50 hidden lg:block">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="font-semibold text-sm">Mini Calendar</h3>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                    <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground mb-2">
                      <div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div><div>S</div>
                    </div>
                    <div className="grid grid-cols-7 text-center text-xs gap-y-2">
                      {/* Mock days for visual effect */}
                      {[...Array(31)].map((_, i) => (
                        <div key={i} className={`p-1 w-6 h-6 mx-auto flex items-center justify-center rounded-full hover:bg-muted cursor-pointer ${i === 14 ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}`}>
                          {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main calendar view */}
            <div className="col-span-9">
              {selectedCalendarId && (
                <CalendarView selectedCalendarId={selectedCalendarId} />
              )}
            </div>
          </div>
        )}

        {/* Event form dialog */}
        <EventForm
          open={eventFormOpen}
          onOpenChange={(open) => {
            setEventFormOpen(open);
            if (!open) {
              selectEvent(null);
              setQuickAddDefaultStart(undefined);
            }
          }}
          initialEvent={selectedEvent}
          calendarId={selectedCalendarId || calendars[0]?.id || ""}
          defaultStartDate={quickAddDefaultStart}
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
