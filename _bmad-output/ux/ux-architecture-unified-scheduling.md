---
stepsCompleted: [1, 2]
inputDocuments: ['prd-unified-scheduling-ui.md', 'brainstorming-session-2026-03-18-unified-scheduling-ui.md']
workflowType: 'ux-architecture'
status: 'draft'
version: '1.0'
---

# UX Architecture Document
## Unified Scheduling UI - Tasks, Calendar, Resource Booking

**Author:** Etienne
**Date:** 2026-03-18
**Version:** 1.0
**Status:** Draft
**Reference PRD:** prd-unified-scheduling-ui.md

---

## 1. Design System

### 1.1 Design Tokens

#### Colors

```typescript
const colors = {
  // Brand
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Main
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Semantic - Events
  event: {
    default: '#3b82f6',    // Blue
    meeting: '#8b5cf6',    // Purple
    task: '#f59e0b',       // Amber
    booking: '#10b981',    // Emerald
    personal: '#ec4899',   // Pink
    deadline: '#ef4444',   // Red
  },

  // Semantic - Status
  status: {
    available: '#22c55e',
    busy: '#ef4444',
    tentative: '#f59e0b',
    outOfOffice: '#6b7280',
  },

  // Heatmap (density)
  heatmap: {
    empty: '#f3f4f6',
    low: '#dcfce7',
    medium: '#fef08a',
    high: '#fed7aa',
    overload: '#fecaca',
  },

  // Now Line
  nowLine: '#ef4444',

  // Surface
  surface: {
    background: 'var(--background)',
    card: 'var(--card)',
    muted: 'var(--muted)',
    accent: 'var(--accent)',
  },
};
```

#### Typography

```typescript
const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },

  fontSize: {
    xs: '0.75rem',     // 12px - timestamps
    sm: '0.875rem',    // 14px - secondary text
    base: '1rem',      // 16px - body
    lg: '1.125rem',    // 18px - titles
    xl: '1.25rem',     // 20px - headings
    '2xl': '1.5rem',   // 24px - page titles
    '3xl': '1.875rem', // 30px - hero
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};
```

#### Spacing

```typescript
const spacing = {
  // Base unit: 4px
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px

  // Calendar-specific
  hourHeight: '60px',      // Height of 1 hour slot
  dayHeaderHeight: '48px', // Day column header
  timeGutterWidth: '60px', // Time labels column
  eventMinHeight: '24px',  // Minimum event block
};
```

#### Shadows & Borders

```typescript
const effects = {
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    event: '0 2px 4px rgba(0, 0, 0, 0.1)',
    eventHover: '0 4px 12px rgba(0, 0, 0, 0.15)',
    commandPalette: '0 25px 50px rgba(0, 0, 0, 0.25)',
  },

  borderRadius: {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    full: '9999px',
  },

  border: {
    default: '1px solid var(--border)',
    event: '2px solid transparent',
    eventActive: '2px solid var(--primary)',
  },
};
```

#### Animation

```typescript
const animation = {
  duration: {
    instant: '50ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },

  // Framer Motion presets
  transitions: {
    viewSwitch: { type: 'spring', stiffness: 300, damping: 30 },
    eventDrag: { type: 'spring', stiffness: 500, damping: 35 },
    commandPalette: { type: 'spring', stiffness: 400, damping: 28 },
    slideIn: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};
```

---

## 2. Component Library

### 2.1 Core Components

#### SchedulingHub (Container Principal)

```typescript
interface SchedulingHubProps {
  defaultTab?: 'my-day' | 'tasks' | 'resources' | 'team';
  defaultView?: ViewType;
}

// Layout:
// Desktop: Sidebar (240px) + Main Content
// Tablet: Collapsible Sidebar + Main
// Mobile: Bottom Tabs + Full Screen Content
```

#### ViewSwitcher

```typescript
interface ViewSwitcherProps {
  views: ViewType[];
  activeView: ViewType;
  onChange: (view: ViewType) => void;
  compact?: boolean; // Mobile: icons only
}

type ViewType = 'agenda' | 'day' | '3-day' | 'week' | 'month';

// Comportement:
// - Keyboard: 1-5 pour switch
// - Animation: slide + fade entre vues
// - Gesture: pinch pour zoom (mobile)
```

#### DateNavigator

```typescript
interface DateNavigatorProps {
  currentDate: Date;
  view: ViewType;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  onDateSelect: (date: Date) => void;
}

// Affiche:
// - Titre contextualisé (ex: "Mars 2026", "Semaine 12")
// - Boutons prev/next
// - Bouton Today
// - Mini calendar dropdown
```

### 2.2 Calendar Components

#### TimeGrid (Vue Jour/3-Day/Semaine)

```typescript
interface TimeGridProps {
  startDate: Date;
  days: number; // 1, 3, or 7
  events: ScheduleBlock[];
  workingHours?: { start: number; end: number }; // 9-18
  slotDuration?: 15 | 30 | 60;
  onEventClick: (event: ScheduleBlock) => void;
  onSlotClick: (start: Date, end: Date) => void;
  onEventDrop: (event: ScheduleBlock, newStart: Date) => void;
  onEventResize: (event: ScheduleBlock, newEnd: Date) => void;
}

// Structure:
// ┌─────────┬────────────┬────────────┬────────────┐
// │ Time    │ Mon 18     │ Tue 19     │ Wed 20     │
// │ Gutter  │ All-day    │ All-day    │ All-day    │
// ├─────────┼────────────┼────────────┼────────────┤
// │ 09:00   │ [Event]    │            │ [Event]    │
// │ 09:30   │            │ [Task]     │            │
// │ 10:00   │            │            │            │
// │ ...     │            │            │            │
// └─────────┴────────────┴────────────┴────────────┘
```

#### EventBlock

```typescript
interface EventBlockProps {
  event: ScheduleBlock;
  layout: EventLayout;
  isDragging?: boolean;
  isResizing?: boolean;
  isSelected?: boolean;
  compact?: boolean;
  onClick: () => void;
}

interface EventLayout {
  top: number;      // % from container top
  height: number;   // % height
  left: number;     // % for overlapping events
  width: number;    // % width
  column: number;   // For multi-column overlap
}

// Visual States:
// - Default: Solid background with left border accent
// - Hover: Elevated shadow, slight scale
// - Dragging: Reduced opacity, transform cursor
// - Selected: Primary border, focus ring
// - Past: Reduced opacity (0.7)
```

#### MonthGrid

```typescript
interface MonthGridProps {
  month: Date;
  events: ScheduleBlock[];
  showWeekends?: boolean;
  heatmapMode?: boolean;
  onDayClick: (date: Date) => void;
  onEventClick: (event: ScheduleBlock) => void;
}

// Structure:
// ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
// │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │
// ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
// │  1  │  2  │  3  │  4  │  5  │  6  │  7  │
// │ ••  │ ••• │     │ •   │ ••••│     │     │
// ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
// │ ...                                     │
// └─────────────────────────────────────────┘
//
// Heatmap: Background color based on event density
// Dots: Up to 4 colored dots for events
// Click: Expand day details
```

#### AgendaList

```typescript
interface AgendaListProps {
  startDate: Date;
  events: ScheduleBlock[];
  groupBy: 'day' | 'week';
  onEventClick: (event: ScheduleBlock) => void;
  onLoadMore: () => void;
}

// Structure:
// ┌────────────────────────────────────────┐
// │ Aujourd'hui - Mardi 18 Mars            │ <- Sticky header
// ├────────────────────────────────────────┤
// │ 09:00 │ ● Standup quotidien      30m   │
// │ 10:00 │ ● Revue design           1h    │
// │ 14:00 │ ○ [Task] Fix bug #234          │
// ├────────────────────────────────────────┤
// │ Demain - Mercredi 19 Mars              │
// ├────────────────────────────────────────┤
// │ 09:00 │ ● Sprint planning        2h    │
// └────────────────────────────────────────┘
//
// - Infinite scroll bidirectionnel
// - Sticky day headers
// - Tasks intégrées avec icône différente
```

#### NowLine

```typescript
interface NowLineProps {
  containerRef: RefObject<HTMLDivElement>;
}

// Visual:
// ────────●──────────────────── 14:32
//
// - Ligne rouge horizontale
// - Point sur le bord gauche
// - Label heure à droite
// - Update chaque minute
// - Auto-scroll au chargement
```

### 2.3 Task Components

#### KanbanBoard

```typescript
interface KanbanBoardProps {
  columns: KanbanColumn[];
  tasks: Task[];
  onTaskMove: (taskId: string, columnId: string, index: number) => void;
  onTaskClick: (task: Task) => void;
  onQuickAdd: (columnId: string, title: string) => void;
}

interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  limit?: number;
}

// Colonnes par défaut:
// | Backlog | Today | In Progress | Done |
//
// Features:
// - Drag & drop entre colonnes
// - Quick add inline
// - Collapse columns
// - WIP limits
```

#### TaskCard

```typescript
interface TaskCardProps {
  task: Task;
  compact?: boolean;
  showProject?: boolean;
  isDragging?: boolean;
  onCheck: () => void;
  onClick: () => void;
}

// Structure:
// ┌──────────────────────────────────┐
// │ ☐ Fix authentication bug   🔴 P1│
// │ #proj-auth  @marc  Due: Today   │
// └──────────────────────────────────┘
```

### 2.4 Resource Components

#### ResourceGrid

```typescript
interface ResourceGridProps {
  resources: Resource[];
  date: Date;
  bookings: Booking[];
  timeRange: { start: number; end: number };
  onSlotClick: (resource: Resource, start: Date, end: Date) => void;
  onBookingClick: (booking: Booking) => void;
}

// Structure:
// ┌────────────┬──────┬──────┬──────┬──────┬──────┐
// │ Resource   │ 09:00│ 10:00│ 11:00│ 12:00│ 13:00│
// ├────────────┼──────┼──────┼──────┼──────┼──────┤
// │ Salle A    │██████│██████│      │      │██████│
// │ Salle B    │      │██████│██████│██████│      │
// │ Projecteur │██████│      │      │      │      │
// └────────────┴──────┴──────┴──────┴──────┴──────┘
//
// - Green = available
// - Red = booked
// - Click empty = quick book
```

#### FloorPlan (P2)

```typescript
interface FloorPlanProps {
  floorId: string;
  resources: Resource[];
  bookings: Booking[];
  currentTime: Date;
  onResourceClick: (resource: Resource) => void;
}

// SVG interactif avec:
// - Salles cliquables
// - Code couleur disponibilité
// - Tooltip info au hover
// - Zoom & pan
```

### 2.5 Team Components

#### AvailabilityHeatmap

```typescript
interface AvailabilityHeatmapProps {
  members: TeamMember[];
  dateRange: { start: Date; end: Date };
  onSlotClick: (members: TeamMember[], start: Date) => void;
}

// Structure:
// ┌────────────┬──────┬──────┬──────┬──────┬──────┐
// │ Team       │ 09:00│ 10:00│ 11:00│ 12:00│ 13:00│
// ├────────────┼──────┼──────┼──────┼──────┼──────┤
// │ Marc       │ ░░░░ │ ████ │ ████ │ ░░░░ │ ░░░░ │
// │ Sophie     │ ░░░░ │ ░░░░ │ ████ │ ████ │ ░░░░ │
// │ Alex       │ ████ │ ░░░░ │ ░░░░ │ ░░░░ │ ████ │
// ├────────────┼──────┼──────┼──────┼──────┼──────┤
// │ All Free   │  ✓   │      │      │  ✓   │      │
// └────────────┴──────┴──────┴──────┴──────┴──────┘
```

#### MeetingSlotFinder

```typescript
interface MeetingSlotFinderProps {
  participants: string[];
  duration: number;
  dateRange: { start: Date; end: Date };
  constraints?: {
    preferredHours?: { start: number; end: number };
    excludeWeekends?: boolean;
  };
  onSlotSelect: (start: Date, end: Date) => void;
}

// Suggestions:
// 1. ✓ Demain 10:00 - 11:00 (Tous disponibles)
// 2. ✓ Demain 14:00 - 15:00 (Tous disponibles)
// 3. ⚠ Jeudi 09:00 - 10:00 (Marc tentative)
```

### 2.6 Command Palette

#### CommandPalette

```typescript
interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  recentCommands?: Command[];
  onCommandExecute: (command: Command, input?: string) => void;
}

interface Command {
  id: string;
  icon: ReactNode;
  label: string;
  shortcut?: string;
  category: 'navigation' | 'create' | 'search' | 'action';
  action: () => void;
}

// Structure:
// ┌──────────────────────────────────────────────┐
// │ 🔍 Réunion avec Marc demain 14h             │
// ├──────────────────────────────────────────────┤
// │ Créer                                        │
// │   📅 Nouvel événement                    ⌘N  │
// │   ✓  Nouvelle tâche                      ⌘T  │
// │   🏢 Réserver une salle                  ⌘B  │
// ├──────────────────────────────────────────────┤
// │ Navigation                                   │
// │   📆 Aller à aujourd'hui                 T   │
// │   📆 Aller à une date...                 G   │
// │   👁 Vue semaine                          3   │
// └──────────────────────────────────────────────┘
```

#### NaturalLanguageParser

```typescript
interface ParseResult {
  type: 'event' | 'task' | 'booking' | 'navigation' | 'search';
  confidence: number;
  extracted: {
    title?: string;
    date?: Date;
    time?: string;
    duration?: number;
    participants?: string[];
    location?: string;
    recurrence?: RecurrenceRule;
    priority?: 'low' | 'medium' | 'high';
  };
  suggestions?: ParseResult[];
}

// Exemples supportés:
// "Réunion avec @marc demain 14h" → Event
// "Fix bug #234 pour vendredi urgent" → Task
// "Salle 6 personnes demain matin" → Booking
// "Aller à la semaine prochaine" → Navigation
```

### 2.7 Quick Actions

#### FloatingActionButton (Mobile)

```typescript
interface FABProps {
  actions: QuickAction[];
  position?: 'bottom-right' | 'bottom-center';
}

// États:
// - Collapsed: Single + button
// - Expanded: Radial menu with actions
// - Actions: New Event, New Task, Book Room
```

#### QuickAddBar (Desktop)

```typescript
interface QuickAddBarProps {
  placeholder: string;
  onSubmit: (text: string) => void;
  suggestions?: string[];
}

// Toujours visible en haut du contenu
// Input avec parsing en temps réel
// Preview de l'interprétation
```

---

## 3. Layout Patterns

### 3.1 Desktop Layout (> 1024px)

```
┌──────────────────────────────────────────────────────────┐
│ Header: Logo | Search | Notifications | User             │
├─────────────┬────────────────────────────────────────────┤
│             │ View Switcher | Date Navigator | Actions   │
│  Sidebar    ├────────────────────────────────────────────┤
│  (240px)    │                                            │
│             │                                            │
│  - My Day   │              Main Content                  │
│  - Tasks    │         (Calendar / Tasks / etc.)          │
│  - Resources│                                            │
│  - Team     │                                            │
│             │                                            │
│  ─────────  │                                            │
│  Mini Cal   │                                            │
│  Upcoming   │                                            │
│             │                                            │
└─────────────┴────────────────────────────────────────────┘
```

### 3.2 Tablet Layout (640-1024px)

```
┌──────────────────────────────────────────────────────────┐
│ ☰ | Logo | Search                     | 🔔 | 👤          │
├──────────────────────────────────────────────────────────┤
│ [My Day] [Tasks] [Resources] [Team]  | View: [≡][▤][▦]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│                    Main Content                          │
│                                                          │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
│                     + FAB                                │
```

### 3.3 Mobile Layout (< 640px)

```
┌────────────────────────────┐
│ < Mars 2026      🔍   ⚙️   │
├────────────────────────────┤
│ [Agenda][Jour][Sem][Mois]  │
├────────────────────────────┤
│                            │
│                            │
│       Main Content         │
│       (Full Screen)        │
│                            │
│                            │
│                            │
│                            │
│                      (+)   │
├────────────────────────────┤
│ [🏠][✓][📅][👥]            │
│ My Day Tasks Cal Team      │
└────────────────────────────┘
```

### 3.4 Responsive Breakpoints

```css
/* Tailwind breakpoints */
sm: 640px   /* Tablet portrait */
md: 768px   /* Tablet landscape */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

---

## 4. Interaction Patterns

### 4.1 Drag & Drop

```typescript
// Using dnd-kit
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

// Event dragging behavior:
// - 8px minimum movement to start
// - Ghost preview follows cursor
// - Snap to 15/30/60 min intervals
// - Cross-day drag supported
// - Visual drop zone indicators
```

### 4.2 Keyboard Navigation

```typescript
const keyboardMap = {
  // Navigation
  'j': 'next-event',
  'k': 'prev-event',
  'h': 'prev-day',
  'l': 'next-day',
  't': 'go-today',
  'g': 'go-to-date-modal',

  // Views (with number keys)
  '1': 'view-agenda',
  '2': 'view-day',
  '3': 'view-3day',
  '4': 'view-week',
  '5': 'view-month',

  // Actions
  'n': 'new-event',
  'shift+n': 'new-task',
  'cmd+k': 'command-palette',
  'enter': 'open-selected',
  'e': 'edit-selected',
  'delete': 'delete-selected',
  'escape': 'deselect-all',

  // Undo/Redo
  'cmd+z': 'undo',
  'cmd+shift+z': 'redo',
};
```

### 4.3 Mobile Gestures

```typescript
const gestureHandlers = {
  // Navigation
  swipeLeft: () => navigateNext(),
  swipeRight: () => navigatePrev(),

  // Zoom
  pinchIn: () => zoomIn(), // day → 3day → week
  pinchOut: () => zoomOut(), // week → 3day → day

  // Context
  longPress: (event) => showContextMenu(event),

  // Quick actions
  swipeDown: () => refreshData(),
  pullToRefresh: true,
};
```

### 4.4 Event Creation Flow

```
Desktop:
1. Click empty slot → Quick create popover
2. Type title + Enter → Event created
3. Click event → Open detail sheet
4. Or: ⌘K → Type "Réunion demain 14h" → Confirm

Mobile:
1. Tap + FAB → Expand menu
2. Select "New Event"
3. Fill quick form (title, date, time)
4. Tap "Create"
```

---

## 5. State Management

### 5.1 Zustand Stores

```typescript
// scheduling-store.ts
interface SchedulingState {
  // View state
  activeTab: 'my-day' | 'tasks' | 'resources' | 'team';
  activeView: ViewType;
  currentDate: Date;
  selectedEventId: string | null;

  // Data
  events: ScheduleBlock[];
  tasks: Task[];
  resources: Resource[];

  // UI state
  isCommandPaletteOpen: boolean;
  isSidebarCollapsed: boolean;
  filters: SchedulingFilters;

  // Actions
  setView: (view: ViewType) => void;
  navigateDate: (direction: 'prev' | 'next' | 'today') => void;
  goToDate: (date: Date) => void;
  selectEvent: (id: string | null) => void;
  createEvent: (event: Partial<ScheduleBlock>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<ScheduleBlock>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

// Persist configuration
persist: {
  name: 'scheduling-store',
  partialize: (state) => ({
    activeView: state.activeView,
    isSidebarCollapsed: state.isSidebarCollapsed,
    filters: state.filters,
  }),
}
```

### 5.2 React Query Integration

```typescript
// Event queries
const useEvents = (dateRange: DateRange) => {
  return useQuery({
    queryKey: ['events', dateRange],
    queryFn: () => calendarApi.getEvents(dateRange),
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
  });
};

// Optimistic updates
const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calendarApi.updateEvent,
    onMutate: async (updatedEvent) => {
      await queryClient.cancelQueries(['events']);
      const previous = queryClient.getQueryData(['events']);
      queryClient.setQueryData(['events'], (old) =>
        old.map(e => e.id === updatedEvent.id ? { ...e, ...updatedEvent } : e)
      );
      return { previous };
    },
    onError: (err, _, context) => {
      queryClient.setQueryData(['events'], context.previous);
      toast.error('Erreur lors de la mise à jour');
    },
    onSettled: () => {
      queryClient.invalidateQueries(['events']);
    },
  });
};
```

### 5.3 Real-time Sync

```typescript
// WebSocket subscription for collaborative updates
useEffect(() => {
  const ws = new WebSocket(WS_URL);

  ws.onmessage = (event) => {
    const { type, payload } = JSON.parse(event.data);

    switch (type) {
      case 'event.created':
        queryClient.invalidateQueries(['events']);
        break;
      case 'event.updated':
        queryClient.setQueryData(['events'], (old) =>
          old.map(e => e.id === payload.id ? payload : e)
        );
        break;
      case 'event.deleted':
        queryClient.setQueryData(['events'], (old) =>
          old.filter(e => e.id !== payload.id)
        );
        break;
    }
  };

  return () => ws.close();
}, []);
```

---

## 6. Animation Specifications

### 6.1 View Transitions

```typescript
// Framer Motion variants
const viewTransitions = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
};

// Usage
<AnimatePresence custom={direction}>
  <motion.div
    key={activeView}
    custom={direction}
    variants={viewTransitions}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
  >
    {renderView()}
  </motion.div>
</AnimatePresence>
```

### 6.2 Event Animations

```typescript
// Event block hover
const eventHover = {
  scale: 1.02,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  transition: { duration: 0.15 },
};

// Drag feedback
const eventDrag = {
  scale: 1.05,
  opacity: 0.8,
  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.2)',
  cursor: 'grabbing',
};

// Creation pop
const eventCreated = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { type: 'spring', stiffness: 500, damping: 25 },
};
```

### 6.3 Command Palette

```typescript
// Overlay backdrop
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// Modal container
const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// Result items stagger
const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03 },
  }),
};
```

### 6.4 Micro-interactions

```typescript
// Now line pulse
const nowLinePulse = {
  animate: {
    opacity: [1, 0.5, 1],
    transition: { repeat: Infinity, duration: 2 },
  },
};

// Task checkbox
const checkboxCheck = {
  initial: { pathLength: 0 },
  animate: { pathLength: 1 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

// FAB expand
const fabExpand = {
  closed: { rotate: 0 },
  open: { rotate: 45 },
};
```

---

## 7. Accessibility (a11y)

### 7.1 ARIA Labels

```tsx
// Calendar grid
<div
  role="grid"
  aria-label="Calendrier semaine du 18 mars 2026"
>
  <div role="row" aria-label="Lundi 18 mars">
    <div
      role="gridcell"
      aria-label="09:00 - Réunion standup, 30 minutes"
      tabIndex={0}
    >
      <EventBlock event={event} />
    </div>
  </div>
</div>

// View switcher
<div role="tablist" aria-label="Sélection de vue">
  <button
    role="tab"
    aria-selected={view === 'week'}
    aria-controls="calendar-week-view"
  >
    Semaine
  </button>
</div>
```

### 7.2 Keyboard Focus

```css
/* Focus visible styles */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Skip link */
.skip-to-main {
  position: absolute;
  left: -9999px;
}
.skip-to-main:focus {
  left: 50%;
  transform: translateX(-50%);
  top: 4px;
  z-index: 100;
}
```

### 7.3 Screen Reader

```tsx
// Live regions for updates
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {announcement}
</div>

// Example announcements:
// "Événement 'Réunion standup' déplacé à 10:00"
// "Tâche 'Fix bug' marquée comme terminée"
// "Nouvelle réservation créée pour Salle A"
```

### 7.4 Reduced Motion

```tsx
const prefersReducedMotion = usePrefersReducedMotion();

const transition = prefersReducedMotion
  ? { duration: 0 }
  : { type: 'spring', stiffness: 300, damping: 30 };
```

---

## 8. Performance Considerations

### 8.1 Virtualization

```typescript
// Virtual scrolling for agenda view
import { useVirtualizer } from '@tanstack/react-virtual';

const AgendaVirtualized = ({ events }) => {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <EventRow
            key={virtualRow.key}
            event={events[virtualRow.index]}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              height: virtualRow.size,
            }}
          />
        ))}
      </div>
    </div>
  );
};
```

### 8.2 Memoization

```typescript
// Expensive computations
const eventsByDay = useMemo(() =>
  groupEventsByDay(events, dateRange),
  [events, dateRange]
);

const overlappingEvents = useMemo(() =>
  calculateOverlaps(dayEvents),
  [dayEvents]
);

// Component memoization
const EventBlock = memo(({ event, layout }) => {
  // ...
}, (prev, next) =>
  prev.event.id === next.event.id &&
  prev.event.updatedAt === next.event.updatedAt
);
```

### 8.3 Code Splitting

```typescript
// Lazy load views
const MonthView = lazy(() => import('./views/MonthView'));
const ResourceGrid = lazy(() => import('./views/ResourceGrid'));
const FloorPlan = lazy(() => import('./views/FloorPlan'));

// Route-based splitting
const SchedulingHub = () => {
  const { activeView } = useSchedulingStore();

  return (
    <Suspense fallback={<ViewSkeleton />}>
      {activeView === 'month' && <MonthView />}
      {activeView === 'resources' && <ResourceGrid />}
      {/* ... */}
    </Suspense>
  );
};
```

---

## 9. File Structure

```
client/src/
├── app/
│   └── scheduling/
│       ├── page.tsx                 # Main scheduling page
│       ├── layout.tsx               # Scheduling layout
│       └── [...slug]/page.tsx       # Dynamic routes
│
├── components/
│   └── scheduling/
│       ├── core/
│       │   ├── SchedulingHub.tsx
│       │   ├── ViewSwitcher.tsx
│       │   ├── DateNavigator.tsx
│       │   └── NowLine.tsx
│       │
│       ├── calendar/
│       │   ├── TimeGrid.tsx
│       │   ├── MonthGrid.tsx
│       │   ├── AgendaList.tsx
│       │   ├── EventBlock.tsx
│       │   └── DayColumn.tsx
│       │
│       ├── tasks/
│       │   ├── KanbanBoard.tsx
│       │   ├── TaskCard.tsx
│       │   └── TaskQuickAdd.tsx
│       │
│       ├── resources/
│       │   ├── ResourceGrid.tsx
│       │   ├── FloorPlan.tsx
│       │   └── QuickBook.tsx
│       │
│       ├── team/
│       │   ├── AvailabilityHeatmap.tsx
│       │   ├── MeetingSlotFinder.tsx
│       │   └── WorkloadDashboard.tsx
│       │
│       ├── command-palette/
│       │   ├── CommandPalette.tsx
│       │   ├── CommandList.tsx
│       │   └── NaturalLanguageParser.ts
│       │
│       └── quick-actions/
│           ├── FAB.tsx
│           └── QuickAddBar.tsx
│
├── hooks/
│   └── scheduling/
│       ├── useSchedulingStore.ts
│       ├── useEvents.ts
│       ├── useTasks.ts
│       ├── useResources.ts
│       ├── useKeyboardNavigation.ts
│       ├── useGestureNavigation.ts
│       └── useNaturalLanguage.ts
│
├── lib/
│   └── scheduling/
│       ├── api/
│       │   ├── calendar.ts
│       │   ├── tasks.ts
│       │   └── resources.ts
│       ├── utils/
│       │   ├── date-helpers.ts
│       │   ├── event-layout.ts
│       │   └── overlap-calculator.ts
│       └── types/
│           └── scheduling.ts
│
└── stores/
    └── scheduling-store.ts
```

---

## 10. Implementation Phases

### Phase 1 (MVP) - 6 semaines
- [ ] SchedulingHub container
- [ ] ViewSwitcher + DateNavigator
- [ ] TimeGrid (Day, Week views)
- [ ] MonthGrid avec heatmap
- [ ] AgendaList
- [ ] EventBlock avec drag & drop basique
- [ ] NowLine
- [ ] Command Palette (navigation + création simple)
- [ ] Mobile responsive
- [ ] Dark mode

### Phase 2 - 4 semaines
- [ ] KanbanBoard pour tasks
- [ ] Task-Calendar integration
- [ ] Natural Language Parser complet
- [ ] Keyboard navigation complète
- [ ] 3-Day view
- [ ] Drag & drop avancé (resize, multi-day)

### Phase 3 - 4 semaines
- [ ] ResourceGrid
- [ ] Quick Book
- [ ] AvailabilityHeatmap
- [ ] MeetingSlotFinder

### Phase 4 - 4 semaines
- [ ] FloorPlan interactif
- [ ] WorkloadDashboard
- [ ] AI auto-scheduling
- [ ] Advanced analytics

---

**Document Control:**
- Created: 2026-03-18
- Last Updated: 2026-03-18
- Next Review: 2026-03-25
- Approvers: [En attente]
