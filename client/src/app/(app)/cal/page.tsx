'use client';

/**
 * Scheduling Page
 *
 * Main entry point for the Unified Scheduling UI.
 * Integrates all views, command palette, and mobile components.
 */

import * as React from 'react';
import { format } from 'date-fns';
import { SchedulingHub, SchedulingContent } from '@/components/scheduling/core/SchedulingHub';
import { DayView, ThreeDayView } from '@/components/scheduling/views/DayView';
import { WeekView } from '@/components/scheduling/views/WeekView';
import { MonthView } from '@/components/scheduling/views/MonthView';
import { AgendaView } from '@/components/scheduling/views/AgendaView';
import { TasksView } from '@/components/scheduling/views/TasksView';
import { TimelineView } from '@/components/scheduling/views/TimelineView';
import { KanbanView } from '@/components/scheduling/views/KanbanView';
import { HeatmapView } from '@/components/scheduling/views/HeatmapView';
import { RosterView } from '@/components/scheduling/views/RosterView';
import { ResourcesView } from '@/components/scheduling/resources/ResourcesView';
import { TeamView } from '@/components/scheduling/team/TeamView';
import { CommandPalette } from '@/components/scheduling/command-palette/CommandPalette';
import { QuickCreate } from '@/components/scheduling/command-palette/QuickCreate';
import { EventSheet } from '@/components/scheduling/calendar/EventSheet';
import { BottomTabs } from '@/components/scheduling/mobile/BottomTabs';
import { FAB } from '@/components/scheduling/quick-actions/FAB';
import { useSchedulingNavigation } from '@/stores/scheduling-store';
import { useCalendarStore } from '@/stores/scheduling/calendar-store';
import { useCreateEvent, useUpdateEvent, useDeleteEvent, useCalendars } from '@/lib/scheduling/api/calendar';
import type { ScheduleBlock, CreateEventInput } from '@/lib/scheduling/types/scheduling';
import type { TimeItem } from '@/lib/scheduling/types';
import { toast } from 'sonner';

export default function SchedulingPage() {
  const { activeTab, currentDate } = useSchedulingNavigation();
  // Use calendar-store for view (controlled by ViewSwitcher)
  const view = useCalendarStore((state) => state.view);
  const calendarCurrentDate = useCalendarStore((state) => state.currentDate);

  const [isQuickCreateOpen, setIsQuickCreateOpen] = React.useState(false);
  const [isEventSheetOpen, setIsEventSheetOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<ScheduleBlock | null>(null);
  const [defaultEventDate, setDefaultEventDate] = React.useState<Date | undefined>();
  const [defaultEventTime, setDefaultEventTime] = React.useState<string | undefined>();

  // Fetch calendars to get a valid calendarId
  const { data: calendars } = useCalendars();
  const defaultCalendarId = calendars?.[0]?.id;

  // Mutations
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  // Convert TimeItem to ScheduleBlock for the sheet
  const timeItemToScheduleBlock = (item: TimeItem): ScheduleBlock => ({
    id: item.id,
    type: item.type === 'task' ? 'task' : item.type === 'booking' ? 'booking' : 'event',
    title: item.title,
    description: item.description,
    start: item.startTime ? new Date(item.startTime) : new Date(),
    end: item.endTime ? new Date(item.endTime) : undefined,
    allDay: item.allDay,
    color: item.color,
    status: item.status === 'done' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : 'confirmed',
    priority: item.priority,
    tags: item.tags,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  });

  // Event handlers
  const handleItemClick = (item: TimeItem) => {
    setSelectedEvent(timeItemToScheduleBlock(item));
    setIsEventSheetOpen(true);
  };

  const handleCreateEvent = (start?: Date, end?: Date) => {
    setSelectedEvent(null);
    if (start) {
      setDefaultEventDate(start);
      setDefaultEventTime(format(start, 'HH:mm'));
    } else {
      setDefaultEventDate(calendarCurrentDate);
      setDefaultEventTime(undefined);
    }
    setIsEventSheetOpen(true);
  };

  const handleDayClick = (date: Date) => {
    setSelectedEvent(null);
    setDefaultEventDate(date);
    setDefaultEventTime('09:00');
    setIsEventSheetOpen(true);
  };

  const handleSaveEvent = (input: CreateEventInput) => {
    if (selectedEvent) {
      // Update existing event
      updateEvent.mutate(
        { eventId: selectedEvent.id, input },
        { onSuccess: () => setIsEventSheetOpen(false) }
      );
    } else {
      // Create new event - use the first available calendar
      const calendarId = input.calendarId || defaultCalendarId;
      if (!calendarId) {
        console.error('No calendar available to create event');
        toast.error('Aucun calendrier disponible pour créer un événement');
        return;
      }
      createEvent.mutate(
        { calendarId, input },
        { onSuccess: () => setIsEventSheetOpen(false) }
      );
    }
  };

  const handleDeleteEvent = () => {
    if (selectedEvent) {
      deleteEvent.mutate(selectedEvent.id, {
        onSuccess: () => setIsEventSheetOpen(false),
      });
    }
  };

  const handleCloseEventSheet = () => {
    setIsEventSheetOpen(false);
    setSelectedEvent(null);
    setDefaultEventDate(undefined);
    setDefaultEventTime(undefined);
  };

  // Render view based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'my-day':
        return renderCalendarView();
      case 'tasks':
        return <TasksView />;
      case 'resources':
        return <ResourcesView />;
      case 'team':
        return <TeamView />;
      default:
        return renderCalendarView();
    }
  };

  // Render calendar view based on view type (from calendar-store)
  const renderCalendarView = () => {
    switch (view) {
      case 'agenda':
        return <AgendaView onItemClick={handleItemClick} />;
      case 'day':
        return <DayView onItemClick={handleItemClick} onCreateItem={handleCreateEvent} />;
      case '3-day':
        return <ThreeDayView onItemClick={handleItemClick} onCreateItem={handleCreateEvent} />;
      case 'week':
        return <WeekView onItemClick={handleItemClick} onCreateItem={handleCreateEvent} />;
      case 'month':
        return (
          <MonthView
            onItemClick={handleItemClick}
            onDayClick={handleDayClick}
          />
        );
      case 'timeline':
        return <TimelineView onItemClick={handleItemClick} />;
      case 'kanban':
        return <KanbanView onItemClick={handleItemClick} />;
      case 'heatmap':
        return <HeatmapView />;
      case 'roster':
        return <RosterView />;
      default:
        return <WeekView onItemClick={handleItemClick} onCreateItem={handleCreateEvent} />;
    }
  };

  return (
    <>
      <SchedulingHub
        onCreateItem={() => handleCreateEvent()}
        onQuickCreate={() => setIsQuickCreateOpen(true)}
      >
        <SchedulingContent className="p-4 pb-16 md:pb-4 overflow-auto">
          <div className="h-full min-h-0 rounded-lg border bg-card shadow-sm overflow-hidden flex flex-col">
            {renderContent()}
          </div>
        </SchedulingContent>
      </SchedulingHub>

      {/* Command Palette (global) */}
      <CommandPalette />

      {/* Quick Create Modal */}
      <QuickCreate
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
      />

      {/* Event Sheet (Create/Edit) */}
      <EventSheet
        isOpen={isEventSheetOpen}
        onClose={handleCloseEventSheet}
        event={selectedEvent}
        defaultDate={defaultEventDate}
        defaultTime={defaultEventTime}
        onSave={handleSaveEvent}
        onDelete={selectedEvent ? handleDeleteEvent : undefined}
      />

      {/* Mobile Bottom Tabs */}
      <BottomTabs />

      {/* Floating Action Button */}
      <FAB
        onQuickCreate={() => setIsQuickCreateOpen(true)}
        onCreateItem={(_type) => handleCreateEvent()}
      />
    </>
  );
}

