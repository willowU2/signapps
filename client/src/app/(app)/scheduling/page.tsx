'use client';

/**
 * Scheduling Page
 *
 * Main entry point for the Unified Scheduling UI.
 * Routes to appropriate view based on active tab and view type.
 */

import * as React from 'react';
import { SchedulingHub, SchedulingContent } from '@/components/scheduling/core/SchedulingHub';
import { useSchedulingNavigation } from '@/stores/scheduling-store';
import { useEvents } from '@/lib/scheduling/api/calendar';

export default function SchedulingPage() {
  const { activeTab, activeView, getDateRange } = useSchedulingNavigation();
  const dateRange = getDateRange();

  // Fetch events for current date range
  const { data: events, isLoading } = useEvents({
    start: dateRange.start,
    end: dateRange.end,
  });

  // Render view based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'my-day':
        return renderCalendarView();
      case 'tasks':
        return <TasksPlaceholder />;
      case 'resources':
        return <ResourcesPlaceholder />;
      case 'team':
        return <TeamPlaceholder />;
      default:
        return renderCalendarView();
    }
  };

  // Render calendar view based on view type
  const renderCalendarView = () => {
    // Placeholder views - will be replaced with actual implementations
    switch (activeView) {
      case 'agenda':
        return <AgendaViewPlaceholder events={events} isLoading={isLoading} />;
      case 'day':
        return <DayViewPlaceholder events={events} isLoading={isLoading} />;
      case '3-day':
        return <ThreeDayViewPlaceholder events={events} isLoading={isLoading} />;
      case 'week':
        return <WeekViewPlaceholder events={events} isLoading={isLoading} />;
      case 'month':
        return <MonthViewPlaceholder events={events} isLoading={isLoading} />;
      default:
        return <WeekViewPlaceholder events={events} isLoading={isLoading} />;
    }
  };

  return (
    <SchedulingHub>
      <SchedulingContent>{renderContent()}</SchedulingContent>
    </SchedulingHub>
  );
}

// ============================================================================
// Placeholder Components (to be replaced in subsequent stories)
// ============================================================================

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );
}

function ViewPlaceholder({
  title,
  subtitle,
  eventCount,
  isLoading,
}: {
  title: string;
  subtitle: string;
  eventCount?: number;
  isLoading?: boolean;
}) {
  if (isLoading) return <LoadingState />;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-xl bg-muted/50 p-8 text-center">
        <h3 className="text-2xl font-bold">{title}</h3>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
        {eventCount !== undefined && (
          <p className="mt-4 text-sm">
            <span className="font-semibold text-primary">{eventCount}</span>{' '}
            événement{eventCount !== 1 ? 's' : ''} trouvé{eventCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

function AgendaViewPlaceholder({ events, isLoading }: { events?: any[]; isLoading?: boolean }) {
  return (
    <ViewPlaceholder
      title="Vue Agenda"
      subtitle="Liste chronologique des événements (Story 1.2.6)"
      eventCount={events?.length}
      isLoading={isLoading}
    />
  );
}

function DayViewPlaceholder({ events, isLoading }: { events?: any[]; isLoading?: boolean }) {
  return (
    <ViewPlaceholder
      title="Vue Jour"
      subtitle="Affichage détaillé d'une journée (Story 1.2.3)"
      eventCount={events?.length}
      isLoading={isLoading}
    />
  );
}

function ThreeDayViewPlaceholder({ events, isLoading }: { events?: any[]; isLoading?: boolean }) {
  return (
    <ViewPlaceholder
      title="Vue 3 Jours"
      subtitle="Affichage de 3 jours consécutifs (Story 1.2.3)"
      eventCount={events?.length}
      isLoading={isLoading}
    />
  );
}

function WeekViewPlaceholder({ events, isLoading }: { events?: any[]; isLoading?: boolean }) {
  return (
    <ViewPlaceholder
      title="Vue Semaine"
      subtitle="Affichage de la semaine complète (Story 1.2.4)"
      eventCount={events?.length}
      isLoading={isLoading}
    />
  );
}

function MonthViewPlaceholder({ events, isLoading }: { events?: any[]; isLoading?: boolean }) {
  return (
    <ViewPlaceholder
      title="Vue Mois"
      subtitle="Grille mensuelle avec événements (Story 1.2.5)"
      eventCount={events?.length}
      isLoading={isLoading}
    />
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
