"use client";

import React, { useEffect, useState } from "react";
import { useCalendarStore } from "@/stores/calendar-store";
import { calendarApi } from "@/lib/calendar-api";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { EventForm } from "@/components/calendar/EventForm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";

export default function CalendarPage() {
  const {
    calendars,
    setCalendars,
    selectedEventId,
    setSelectedCalendars,
  } = useCalendarStore();

  const [isLoading, setIsLoading] = useState(true);
  const [eventFormOpen, setEventFormOpen] = useState(false);
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
      } catch (error) {
        console.error("Failed to load calendars:", error);
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
          <Button
            onClick={() => setEventFormOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Event
          </Button>
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
      </div>
    </AppLayout>
  );
}
