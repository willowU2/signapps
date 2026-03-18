"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useCalendarStore, useCalendarSelection } from "@/stores/calendar-store";
import { useEntityStore } from "@/stores/entity-hub-store";
import { useShallow } from "zustand/react/shallow";
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
import { useCalendarWebSocket } from "@/hooks/use-calendar-websocket";
import { useAuthStore } from "@/lib/store";
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
  // Granular selectors for optimized re-renders
  const calendars = useCalendarStore((state) => state.calendars);
  const setCalendars = useCalendarStore((state) => state.setCalendars);
  const setSelectedCalendars = useCalendarStore((state) => state.setSelectedCalendars);
  const events = useCalendarStore((state) => state.events);
  const viewMode = useCalendarStore((state) => state.viewMode);
  const setViewMode = useCalendarStore((state) => state.setViewMode);
  const { selectedEventId, selectEvent } = useCalendarSelection();

  // Auth for presence tracking
  const user = useAuthStore((state) => state.user);

  // Unified Entity Hub sync
  const { fetchTasks, fetchProjects } = useEntityStore();

  useEffect(() => {
    // Sync unified multi-tenant entities in the background for global views
    fetchTasks();
    fetchProjects();
  }, [fetchTasks, fetchProjects]);

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

  // Real-time presence tracking via WebSocket
  const {
    isConnected: wsConnected,
    presence,
    tracking,
  } = useCalendarWebSocket({
    calendar_id: selectedCalendarId,
    username: user?.username || "Anonymous",
    enabled: !!selectedCalendarId,
  });

  // Track editing state when opening event form
  const handleEventFormOpen = useCallback(
    (open: boolean) => {
      setEventFormOpen(open);
      if (!open) {
        selectEvent(null);
        setQuickAddDefaultStart(undefined);
        // Clear editing state when closing
        tracking.editing(null);
      }
    },
    [selectEvent, tracking]
  );

  // Track when editing a specific event
  useEffect(() => {
    if (selectedEventId && eventFormOpen) {
      tracking.editing(selectedEventId);
    }
  }, [selectedEventId, eventFormOpen, tracking]);

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
          // No calendars exist - create a default one via API
          try {
            const newCalResponse = await calendarApi.createCalendar({
              name: "Mon agenda",
              color: "#3b82f6",
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              is_shared: false
            });
            setCalendars([newCalResponse.data]);
            setSelectedCalendarId(newCalResponse.data.id);
            setSelectedCalendars([newCalResponse.data]);
          } catch (createErr) {
            console.debug('Failed to create default calendar:', createErr);
            // Leave empty - user can create manually
          }
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
      <div className="h-[calc(100vh-8rem)] w-full flex flex-col glass-panel text-foreground overflow-hidden font-sans rounded-2xl border border-border/50 shadow-premium">
        {/* Full viewport Classic Calendar Layout */}
        
        {/* 1. Top Header */}
      <CalendarHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        presence={presence}
        currentUserId={user?.id}
        isConnected={wsConnected}
      />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 2. Left Sidebar (w-64) */}
        <CalendarSidebar
          calendars={calendars}
          selectedCalendarId={selectedCalendarId}
          onSelectCalendar={setSelectedCalendarId}
          onCreateEvent={() => {
            setEventFormOpen(true);
            // Track that user is creating a new event (no specific ID)
            tracking.editing("new");
          }}
        />

        {/* 3. Main Calendar View Area */}
        <div className="flex-1 h-full overflow-hidden relative glass-panel ml-4 rounded-xl border border-border/50">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              Loading calendar grid...
            </div>
          ) : calendars.length === 0 ? (
            <div className="flex flex-col h-full w-full items-center justify-center text-muted-foreground">
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
        onOpenChange={handleEventFormOpen}
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
