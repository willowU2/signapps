"use client";

/**
 * CalendarHub
 *
 * Composant principal du calendrier unifié.
 * Intègre le sélecteur de vues (11 vues), la navigation par date,
 * la recherche, le mini-calendrier, le panneau de couches et les vues.
 *
 * Fixes applied:
 * - Load user's calendars on mount, auto-select first
 * - Mount EventForm dialog (create + edit)
 * - "+ Nouveau" button in header
 * - Pass selectedCalendarId + onCreateEvent to all views
 * - selectEvent opens EventForm for editing
 * - DndContext wrapping MonthCalendar for drag-and-drop
 */

import React, { Suspense, lazy, useState, useEffect, useCallback } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameYear,
  isToday,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  CalendarRange,
  Grid3X3,
  List,
  Clock,
  Columns3,
  Activity,
  Users,
  CheckSquare,
  UserCheck,
  Table2,
  ChevronLeft,
  ChevronRight,
  Search,
  Layers,
  PanelLeft,
  X,
  Plus,
} from "lucide-react";
import { DndContext, DragEndEvent, DragOverlay } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCalendarStore, type ViewType } from "@/stores/calendar-store";
import { MiniCalendar } from "./mini-calendar";
import { LayerPanel } from "./LayerPanel";
import { EventForm } from "./EventForm";
import { calendarApi } from "@/lib/api/calendar";
import { Calendar, Event } from "@/types/calendar";
import { useEvents } from "@/hooks/use-events";
import { toast } from "sonner";

// ============================================================================
// Lazy view imports
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VIEW_MAP: Record<ViewType, React.LazyExoticComponent<any>> = {
  day: lazy(() =>
    import("./DayCalendar").then((m) => ({ default: m.DayCalendar })),
  ),
  week: lazy(() =>
    import("./WeekCalendar").then((m) => ({ default: m.WeekCalendar })),
  ),
  month: lazy(() =>
    import("./MonthCalendar").then((m) => ({ default: m.MonthCalendar })),
  ),
  agenda: lazy(() =>
    import("./AgendaView").then((m) => ({ default: m.AgendaView })),
  ),
  timeline: lazy(() => import("./TimelineView")),
  kanban: lazy(() => import("./KanbanView")),
  heatmap: lazy(() => import("./HeatmapView")),
  roster: lazy(() => import("./RosterView")),
  tasks: lazy(() => import("./TasksView")),
  availability: lazy(() => import("./AvailabilityView")),
  presence: lazy(() => import("./PresenceTableView")),
};

// ============================================================================
// View configuration
// ============================================================================

interface ViewConfig {
  id: ViewType;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  shortcut: string;
}

const VIEW_CONFIG: ViewConfig[] = [
  {
    id: "day",
    label: "Jour",
    shortLabel: "Jour",
    icon: CalendarIcon,
    shortcut: "j",
  },
  {
    id: "week",
    label: "Semaine",
    shortLabel: "Sem",
    icon: CalendarRange,
    shortcut: "s",
  },
  {
    id: "month",
    label: "Mois",
    shortLabel: "Mois",
    icon: Grid3X3,
    shortcut: "m",
  },
  {
    id: "agenda",
    label: "Agenda",
    shortLabel: "Agenda",
    icon: List,
    shortcut: "a",
  },
  {
    id: "timeline",
    label: "Frise",
    shortLabel: "Frise",
    icon: Clock,
    shortcut: "t",
  },
  {
    id: "kanban",
    label: "Kanban",
    shortLabel: "Kanban",
    icon: Columns3,
    shortcut: "k",
  },
  {
    id: "heatmap",
    label: "Dispo",
    shortLabel: "Dispo",
    icon: Activity,
    shortcut: "d",
  },
  {
    id: "roster",
    label: "Planning",
    shortLabel: "Plan.",
    icon: Users,
    shortcut: "p",
  },
  {
    id: "tasks",
    label: "Tâches",
    shortLabel: "Tâches",
    icon: CheckSquare,
    shortcut: "x",
  },
  {
    id: "availability",
    label: "Disponibilité",
    shortLabel: "Dispos",
    icon: UserCheck,
    shortcut: "v",
  },
  {
    id: "presence",
    label: "Présence",
    shortLabel: "Prés.",
    icon: Table2,
    shortcut: "r",
  },
];

// ============================================================================
// Date title helper
// ============================================================================

function getDateTitle(view: ViewType, date: Date): string {
  const locale = fr;
  switch (view) {
    case "day":
      if (isToday(date)) return "Aujourd'hui";
      return format(date, "EEEE d MMMM yyyy", { locale });
    case "week":
    case "roster":
    case "heatmap":
    case "availability":
    case "presence": {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });
      if (isSameMonth(start, end))
        return format(start, "MMMM yyyy", { locale });
      if (isSameYear(start, end))
        return `${format(start, "MMM", { locale })} – ${format(end, "MMM yyyy", { locale })}`;
      return `${format(start, "MMM yyyy", { locale })} – ${format(end, "MMM yyyy", { locale })}`;
    }
    case "timeline":
    case "kanban":
    case "tasks":
      return format(date, "MMMM yyyy", { locale });
    default:
      return format(date, "MMMM yyyy", { locale });
  }
}

// ============================================================================
// Suspense fallback
// ============================================================================

function ViewSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground text-sm">
        Chargement…
      </div>
    </div>
  );
}

// ============================================================================
// CalendarHub
// ============================================================================

export function CalendarHub() {
  const {
    view,
    setView,
    currentDate,
    navigateForward,
    navigateBack,
    goToToday,
    sidebarOpen,
    setSidebarOpen,
    layerPanelOpen,
    setLayerPanelOpen,
    searchQuery,
    setSearchQuery,
    selectedEventId,
    selectEvent,
  } = useCalendarStore();

  const [searchExpanded, setSearchExpanded] = useState(false);

  // ── Calendar selection state ─────────────────────────────────────────────
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<
    string | undefined
  >(undefined);

  // Load calendars on mount, auto-select first one
  useEffect(() => {
    calendarApi
      .listCalendars()
      .then((res) => {
        const cals: Calendar[] = Array.isArray(res.data) ? res.data : [];
        setCalendars(cals);
        if (cals.length > 0 && !selectedCalendarId) {
          setSelectedCalendarId(cals[0].id);
        }
      })
      .catch(() => {
        // silently ignore — user may not be authenticated yet
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── EventForm state ──────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formDefaultStart, setFormDefaultStart] = useState<Date | undefined>(
    undefined,
  );
  const [editingEvent, setEditingEvent] = useState<Event | undefined>(
    undefined,
  );

  // Events hook for drag-and-drop updates
  const { events, updateEvent } = useEvents(selectedCalendarId);

  /** Open form to create a new event (optionally with a preselected time slot) */
  const handleCreateEvent = useCallback((startTime?: Date, endTime?: Date) => {
    setEditingEvent(undefined);
    setFormDefaultStart(startTime);
    setFormOpen(true);
  }, []);

  /** Open form to edit an existing event */
  const handleEditEvent = useCallback(
    (eventId: string) => {
      const ev = events.find((e) => e.id === eventId);
      if (ev) {
        setEditingEvent(ev);
        setFormDefaultStart(undefined);
        setFormOpen(true);
      }
    },
    [events],
  );

  // When selectedEventId changes (set by WeekCalendar/DayCalendar/MonthCalendar click),
  // open the edit form if an event is selected.
  useEffect(() => {
    if (selectedEventId) {
      handleEditEvent(selectedEventId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  // Close form and deselect event
  const handleFormOpenChange = useCallback(
    (open: boolean) => {
      setFormOpen(open);
      if (!open) {
        selectEvent(null);
        setEditingEvent(undefined);
      }
    },
    [selectEvent],
  );

  // ── Drag-and-drop (month view) ───────────────────────────────────────────
  const handleDragEnd = useCallback(
    async (dragEvent: DragEndEvent) => {
      const { active, over } = dragEvent;
      if (!over || !active) return;

      const eventId = active.id as string;
      const overData = over.data?.current as
        | { type?: string; date?: string }
        | undefined;

      if (overData?.type !== "calendar-slot" || !overData.date) return;

      const ev = events.find((e) => e.id === eventId);
      if (!ev) return;

      const originalStart = new Date(ev.start_time);
      const originalEnd = new Date(ev.end_time);
      const durationMs = originalEnd.getTime() - originalStart.getTime();

      const newStart = new Date(overData.date);
      // Preserve original time of day
      newStart.setHours(
        originalStart.getHours(),
        originalStart.getMinutes(),
        0,
        0,
      );
      const newEnd = new Date(newStart.getTime() + durationMs);

      try {
        await updateEvent(eventId, {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        });
        toast.success("Événement déplacé");
      } catch {
        toast.error("Impossible de déplacer l'événement");
      }
    },
    [events, updateEvent],
  );

  const ViewComponent = VIEW_MAP[view];
  const dateTitle = getDateTitle(view, currentDate);

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-2 px-3 h-12 border-b border-border bg-card">
        {/* Sidebar toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Basculer le panneau latéral"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Panneau latéral</TooltipContent>
        </Tooltip>

        {/* NEW EVENT button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              className="h-8 gap-1.5 px-3"
              onClick={() => handleCreateEvent()}
              disabled={!selectedCalendarId}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">
                Nouveau
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {selectedCalendarId
              ? "Créer un événement"
              : "Aucun calendrier sélectionné"}
          </TooltipContent>
        </Tooltip>

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={navigateBack}
            aria-label="Période précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs font-medium"
            onClick={goToToday}
          >
            Aujourd'hui
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={navigateForward}
            aria-label="Période suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Date title */}
        <span className="text-sm font-semibold text-foreground min-w-0 truncate capitalize">
          {dateTitle}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Calendar selector (compact) */}
        {calendars.length > 1 && (
          <select
            value={selectedCalendarId ?? ""}
            onChange={(e) => setSelectedCalendarId(e.target.value)}
            className="h-8 text-xs border border-border rounded-md bg-background px-2 text-foreground max-w-[140px] truncate"
            aria-label="Sélectionner un calendrier"
          >
            {calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.name}
              </option>
            ))}
          </select>
        )}

        {/* View switcher tabs */}
        <nav
          className="hidden lg:flex items-center gap-0.5 bg-muted rounded-lg p-0.5"
          aria-label="Sélecteur de vue"
        >
          {VIEW_CONFIG.map((cfg) => {
            const Icon = cfg.icon;
            const active = view === cfg.id;
            return (
              <Tooltip key={cfg.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setView(cfg.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/60",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden xl:inline">{cfg.shortLabel}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {cfg.label}
                  <span className="ml-1.5 text-xs opacity-60">
                    {cfg.shortcut}
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Mobile view switcher (compact) */}
        <nav
          className="flex lg:hidden items-center gap-0.5"
          aria-label="Sélecteur de vue"
        >
          {VIEW_CONFIG.slice(0, 5).map((cfg) => {
            const Icon = cfg.icon;
            const active = view === cfg.id;
            return (
              <button
                key={cfg.id}
                onClick={() => setView(cfg.id)}
                aria-pressed={active}
                className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-md text-xs transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </nav>

        {/* Search */}
        <div className="flex items-center gap-1">
          {searchExpanded ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                placeholder="Rechercher…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-40 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setSearchExpanded(false);
                  setSearchQuery("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSearchExpanded(true)}
                  aria-label="Rechercher"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Rechercher</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Layer panel toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={layerPanelOpen ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setLayerPanelOpen(!layerPanelOpen)}
              aria-label="Couches de calendrier"
              aria-pressed={layerPanelOpen}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Couches</TooltipContent>
        </Tooltip>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        {sidebarOpen && (
          <aside className="shrink-0 w-56 border-r border-border bg-card flex flex-col overflow-y-auto">
            {/* Mini calendar */}
            <div className="p-3 border-b border-border">
              <MiniCalendar
                selectedDate={currentDate}
                onSelectDate={(date) =>
                  useCalendarStore.getState().setCurrentDate(date)
                }
              />
            </div>

            {/* Calendar list in sidebar */}
            {calendars.length > 0 && (
              <div className="p-3 border-b border-border">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Mes agendas
                </p>
                <div className="space-y-1">
                  {calendars.map((cal) => (
                    <button
                      key={cal.id}
                      onClick={() => setSelectedCalendarId(cal.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs text-left transition-colors",
                        selectedCalendarId === cal.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cal.color || "#3b82f6" }}
                      />
                      <span className="truncate">{cal.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Layer panel */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <LayerPanel />
            </div>
          </aside>
        )}

        {/* Main view area — wrapped in DndContext for drag-and-drop */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <DndContext onDragEnd={handleDragEnd}>
            <Suspense fallback={<ViewSkeleton />}>
              {/* Cast to accept shared calendar props — views that don't use them simply ignore them */}
              {React.createElement(
                ViewComponent as React.ComponentType<{
                  selectedCalendarId?: string;
                  onCreateEvent?: (startTime?: Date, endTime?: Date) => void;
                }>,
                {
                  selectedCalendarId,
                  onCreateEvent: handleCreateEvent,
                },
              )}
            </Suspense>
            <DragOverlay />
          </DndContext>
        </main>

        {/* Layer panel (overlay when sidebar is closed) */}
        {!sidebarOpen && layerPanelOpen && (
          <aside className="shrink-0 w-56 border-l border-border bg-card overflow-y-auto">
            <LayerPanel />
          </aside>
        )}
      </div>

      {/* ── EventForm dialog ─────────────────────────────────────────────── */}
      {selectedCalendarId && (
        <EventForm
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          calendarId={selectedCalendarId}
          initialEvent={editingEvent}
          defaultStartDate={formDefaultStart}
        />
      )}
    </div>
  );
}

export default CalendarHub;
