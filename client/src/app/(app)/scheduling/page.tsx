'use client';

/**
 * Scheduling Page
 *
 * Main entry point for the Unified Scheduling UI.
 * Integrates all views, command palette, and mobile components.
 */

import * as React from 'react';
import { SchedulingHub, SchedulingContent } from '@/components/scheduling/core/SchedulingHub';
import { DayView, ThreeDayView } from '@/components/scheduling/views/DayView';
import { WeekView } from '@/components/scheduling/views/WeekView';
import { MonthView } from '@/components/scheduling/views/MonthView';
import { AgendaView } from '@/components/scheduling/views/AgendaView';
import { TasksView } from '@/components/scheduling/views/TasksView';
import { ResourcesView } from '@/components/scheduling/resources/ResourcesView';
import { TeamView } from '@/components/scheduling/team/TeamView';
import { CommandPalette } from '@/components/scheduling/command-palette/CommandPalette';
import { QuickCreate } from '@/components/scheduling/command-palette/QuickCreate';
import { BottomTabs, BottomTabsSpacer } from '@/components/scheduling/mobile/BottomTabs';
import { FAB } from '@/components/scheduling/quick-actions/FAB';
import { useSchedulingNavigation } from '@/stores/scheduling-store';
import type { ScheduleBlock } from '@/lib/scheduling/types/scheduling';

export default function SchedulingPage() {
  const { activeTab, activeView } = useSchedulingNavigation();
  const [isQuickCreateOpen, setIsQuickCreateOpen] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<ScheduleBlock | null>(null);

  // Event handlers
  const handleEventClick = (event: ScheduleBlock) => {
    setSelectedEvent(event);
    // TODO: Open event detail sheet/modal
  };

  const handleCreateEvent = () => {
    setIsQuickCreateOpen(true);
  };

  const handleDayClick = (date: Date) => {
    // TODO: Navigate to day view or open quick create with date
    console.log('Day clicked:', date);
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

  // Render calendar view based on view type
  const renderCalendarView = () => {
    switch (activeView) {
      case 'agenda':
        return <AgendaView onEventClick={handleEventClick} />;
      case 'day':
        return <DayView onEventClick={handleEventClick} onCreateEvent={handleCreateEvent} />;
      case '3-day':
        return <ThreeDayView onEventClick={handleEventClick} onCreateEvent={handleCreateEvent} />;
      case 'week':
        return <WeekView onEventClick={handleEventClick} onCreateEvent={handleCreateEvent} />;
      case 'month':
        return (
          <MonthView
            onEventClick={handleEventClick}
            onDayClick={handleDayClick}
            onCreateEvent={handleDayClick}
          />
        );
      default:
        return <WeekView onEventClick={handleEventClick} onCreateEvent={handleCreateEvent} />;
    }
  };

  return (
    <>
      <SchedulingHub>
        <SchedulingContent className="pb-16 md:pb-0">
          {renderContent()}
        </SchedulingContent>
      </SchedulingHub>

      {/* Command Palette (global) */}
      <CommandPalette />

      {/* Quick Create Modal */}
      <QuickCreate
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
      />

      {/* Mobile Bottom Tabs */}
      <BottomTabs />

      {/* Floating Action Button */}
      <FAB
        onQuickCreate={() => setIsQuickCreateOpen(true)}
        onCreateEvent={handleCreateEvent}
      />
    </>
  );
}

// ============================================================================
// Placeholder Components (Phase 2 features)
// ============================================================================

function ViewPlaceholder({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-xl bg-muted/50 p-8 text-center">
        <h3 className="text-2xl font-bold">{title}</h3>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function TasksPlaceholder() {
  return (
    <ViewPlaceholder
      title="Tâches"
      subtitle="Gestion des tâches avec Kanban (Phase 2)"
    />
  );
}

function ResourcesPlaceholder() {
  return (
    <ViewPlaceholder
      title="Ressources"
      subtitle="Réservation de salles et équipements (Phase 2)"
    />
  );
}

function TeamPlaceholder() {
  return (
    <ViewPlaceholder
      title="Équipe"
      subtitle="Disponibilités de l'équipe (Phase 2)"
    />
  );
}
