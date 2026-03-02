"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useCalendarStore } from "@/stores/calendar-store";
import { calendarApi } from "@/lib/api";
import { CalendarView } from "@/components/calendar/CalendarView";
import { EventForm } from "@/components/calendar/EventForm";
import { ExportDialog } from "@/components/calendar/ExportDialog";
import { ImportDialog } from "@/components/calendar/ImportDialog";
import { ShareDialog } from "@/components/calendar/ShareDialog";
import { TimezoneSelector } from "@/components/calendar/TimezoneSelector";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Download, Upload, MoreVertical, Share2, Zap, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Menu,
  HelpCircle,
  Settings,
  Grid,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from "lucide-react";

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
      <div className="h-[calc(100vh-8rem)] w-full flex flex-col bg-white text-[#3c4043] overflow-hidden font-sans rounded-xl border shadow-sm">
        {/* Full viewport Classic Calendar Layout */}
        
        {/* 1. Top Header */}
      <CalendarHeader viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 2. Left Sidebar (w-64) */}
        <CalendarSidebar
          calendars={calendars}
          selectedCalendarId={selectedCalendarId}
          onSelectCalendar={setSelectedCalendarId}
          onCreateEvent={() => setEventFormOpen(true)}
        />

        {/* 3. Main Calendar View Area */}
        <div className="flex-1 h-full overflow-hidden relative bg-white">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center text-[#5f6368]">
              Loading calendar grid...
            </div>
          ) : calendars.length === 0 ? (
            <div className="flex flex-col h-full w-full items-center justify-center text-[#5f6368]">
              <p className="mb-4">No calendars yet. Create your first calendar to get started.</p>
              <Button onClick={() => setEventFormOpen(true)} className="bg-[#1a73e8] hover:bg-blue-700 text-white rounded">
                Créer un agenda
              </Button>
            </div>
          ) : (
            <div className="h-full w-full relative">
                {selectedCalendarId && (
                  <CalendarView selectedCalendarId={selectedCalendarId} />
                )}
            </div>
          )}
        </div>
      </div>
      

      {/* Modals & Dialogs */}
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

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        calendarId={selectedCalendarId}
        calendarName={
          calendars.find((c) => c.id === selectedCalendarId)?.name || "Calendar"
        }
      />

      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        calendarId={selectedCalendarId}
        onImportComplete={() => {
          setEventFormOpen(false);
        }}
      />

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
