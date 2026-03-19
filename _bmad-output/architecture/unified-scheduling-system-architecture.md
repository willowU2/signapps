---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: ['unified-scheduling-system-prd.md', 'brainstorming-session-2026-03-18-calendar-from-scratch.md']
workflowType: 'architecture'
project_name: 'Unified Scheduling System'
user_name: 'Etienne'
date: '2026-03-18'
status: 'complete'
---

# Architecture Decision Document - Unified Scheduling System

**Author:** Etienne
**Date:** 2026-03-18
**Version:** 1.0

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js 16)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Views     │  │   Core      │  │  Features   │  │     AI      │   │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤   │
│  │ WeekView    │  │ TimeItem    │  │ DayPlanner  │  │ AutoSchedule│   │
│  │ DayView     │  │ ScopeSwitch │  │ SmartInput  │  │ EnergyOpt   │   │
│  │ MonthView   │  │ ViewSelector│  │ Pomodoro    │  │ Suggestions │   │
│  │ AgendaView  │  │ DateNav     │  │ Booking     │  │             │   │
│  │ TimelineView│  │             │  │ Templates   │  │             │   │
│  │ KanbanView  │  │             │  │             │  │             │   │
│  │ HeatmapView │  │             │  │             │  │             │   │
│  │ FocusView   │  │             │  │             │  │             │   │
│  │ RosterView  │  │             │  │             │  │             │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    ZUSTAND STORES                                │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ schedulingStore │ calendarStore │ userPrefsStore │ aiStore      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    API CLIENT LAYER                              │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ schedulingApi │ identityApi │ storageApi │ aiApi                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API (JWT Auth)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICES (Rust/Axum)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │signapps-     │ │signapps-     │ │signapps-     │ │signapps-     │  │
│  │identity      │ │scheduler     │ │storage       │ │ai            │  │
│  │:3001         │ │:3007         │ │:3004         │ │:3005         │  │
│  ├──────────────┤ ├──────────────┤ ├──────────────┤ ├──────────────┤  │
│  │Users, Groups │ │TimeItems     │ │Attachments   │ │Suggestions   │  │
│  │Auth, RBAC    │ │Recurrence    │ │Files         │ │Patterns      │  │
│  │Hierarchy     │ │Reminders     │ │              │ │NLP Parse     │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE (PostgreSQL)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  identity schema │ scheduling schema │ storage schema │ ai schema       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **State Management** | Zustand | Already used in project, simple, performant |
| **Calendar Engine** | Custom (not FullCalendar) | Full control, unified TimeItem model |
| **Drag & Drop** | @dnd-kit | Already integrated, accessible |
| **Date Library** | date-fns | Lightweight, tree-shakeable |
| **Virtual Scrolling** | @tanstack/virtual | Performance for large lists |
| **Backend** | Extend signapps-scheduler | Reuse existing service |

---

## 2. Frontend Architecture

### 2.1 Directory Structure

```
client/src/
├── app/
│   └── scheduling/
│       ├── page.tsx                    # Main scheduling hub
│       ├── layout.tsx                  # Scheduling layout wrapper
│       ├── day/page.tsx                # Day view route
│       ├── week/page.tsx               # Week view route
│       ├── month/page.tsx              # Month view route
│       ├── agenda/page.tsx             # Agenda view route
│       ├── timeline/page.tsx           # Timeline/Gantt route
│       ├── kanban/page.tsx             # Kanban route
│       ├── focus/page.tsx              # Focus mode route
│       ├── roster/page.tsx             # HR roster route
│       └── booking/
│           └── [slug]/page.tsx         # Public booking page
│
├── components/
│   └── scheduling/
│       ├── core/
│       │   ├── TimeItem.tsx            # Unified item display
│       │   ├── TimeItemCard.tsx        # Card variant
│       │   ├── TimeItemChip.tsx        # Compact variant
│       │   ├── ScopeSwitch.tsx         # MOI/EUX/NOUS toggle
│       │   ├── ViewSelector.tsx        # View type selector
│       │   ├── DateNavigator.tsx       # Date navigation
│       │   ├── SmartInput.tsx          # Natural language input
│       │   └── QuickActions.tsx        # FAB menu
│       │
│       ├── views/
│       │   ├── WeekView/
│       │   │   ├── WeekView.tsx        # Main component
│       │   │   ├── WeekHeader.tsx      # Day headers
│       │   │   ├── TimeGrid.tsx        # Hour grid
│       │   │   ├── DayColumn.tsx       # Single day column
│       │   │   ├── EnergyZones.tsx     # Morning/midday/afternoon
│       │   │   ├── TasksSidebar.tsx    # Unscheduled tasks
│       │   │   └── hooks/
│       │   │       ├── useWeekData.ts
│       │   │       └── useWeekDragDrop.ts
│       │   │
│       │   ├── DayView/
│       │   │   ├── DayView.tsx
│       │   │   ├── HourSlots.tsx
│       │   │   └── DayTimeline.tsx
│       │   │
│       │   ├── MonthView/
│       │   │   ├── MonthView.tsx
│       │   │   ├── MonthGrid.tsx
│       │   │   ├── DayCell.tsx
│       │   │   └── MonthMiniItem.tsx
│       │   │
│       │   ├── AgendaView/
│       │   │   ├── AgendaView.tsx
│       │   │   ├── AgendaList.tsx
│       │   │   └── AgendaItem.tsx
│       │   │
│       │   ├── TimelineView/
│       │   │   ├── TimelineView.tsx
│       │   │   ├── GanttChart.tsx
│       │   │   ├── TimelineRow.tsx
│       │   │   ├── DependencyLines.tsx
│       │   │   └── MilestoneMarker.tsx
│       │   │
│       │   ├── KanbanView/
│       │   │   ├── KanbanView.tsx
│       │   │   ├── KanbanColumn.tsx
│       │   │   └── KanbanCard.tsx
│       │   │
│       │   ├── HeatmapView/
│       │   │   ├── HeatmapView.tsx
│       │   │   ├── AvailabilityGrid.tsx
│       │   │   └── HeatmapCell.tsx
│       │   │
│       │   ├── FocusView/
│       │   │   ├── FocusView.tsx
│       │   │   ├── FocusTask.tsx
│       │   │   └── PomodoroTimer.tsx
│       │   │
│       │   └── RosterView/
│       │       ├── RosterView.tsx
│       │       ├── ShiftGrid.tsx
│       │       └── ShiftCell.tsx
│       │
│       ├── features/
│       │   ├── DayPlanner/
│       │   │   ├── DayPlanner.tsx      # Planning wizard
│       │   │   ├── SuggestedDay.tsx
│       │   │   └── PlanningStep.tsx
│       │   │
│       │   ├── Booking/
│       │   │   ├── BookingPage.tsx
│       │   │   ├── SlotPicker.tsx
│       │   │   └── BookingForm.tsx
│       │   │
│       │   ├── Templates/
│       │   │   ├── TemplateManager.tsx
│       │   │   └── TemplateEditor.tsx
│       │   │
│       │   └── Sharing/
│       │       ├── ShareModal.tsx
│       │       ├── PermissionPicker.tsx
│       │       └── ExternalLinkModal.tsx
│       │
│       ├── dialogs/
│       │   ├── TimeItemDialog.tsx      # Create/Edit dialog
│       │   ├── QuickCreateDialog.tsx   # Fast creation
│       │   ├── RecurrenceDialog.tsx
│       │   └── ConflictDialog.tsx
│       │
│       └── ai/
│           ├── AISuggestions.tsx
│           ├── AutoSchedulePreview.tsx
│           └── ConflictResolver.tsx
│
├── lib/
│   └── scheduling/
│       ├── api/
│       │   ├── scheduling-api.ts       # API client
│       │   ├── types.ts                # API types
│       │   └── endpoints.ts            # Endpoint definitions
│       │
│       ├── utils/
│       │   ├── time-utils.ts           # Date/time helpers
│       │   ├── overlap-calculator.ts   # Collision detection
│       │   ├── energy-zones.ts         # Energy level logic
│       │   ├── recurrence.ts           # Recurrence expansion
│       │   ├── natural-language.ts     # NLP parsing
│       │   └── export.ts               # iCal export
│       │
│       ├── hooks/
│       │   ├── useTimeItems.ts         # Main data hook
│       │   ├── useScope.ts             # Scope management
│       │   ├── useCalendarNavigation.ts
│       │   ├── useDragDrop.ts
│       │   ├── usePomodoro.ts
│       │   └── useAISuggestions.ts
│       │
│       └── constants/
│           ├── views.ts
│           ├── scopes.ts
│           └── energy-levels.ts
│
└── stores/
    └── scheduling/
        ├── scheduling-store.ts         # Main store
        ├── calendar-store.ts           # View state
        ├── preferences-store.ts        # User prefs
        └── ai-store.ts                 # AI state
```

### 2.2 State Management

#### Main Scheduling Store

```typescript
// stores/scheduling/scheduling-store.ts

interface SchedulingState {
  // Data
  timeItems: TimeItem[]
  selectedItem: TimeItem | null

  // Filters
  scope: 'moi' | 'eux' | 'nous' | 'all'
  dateRange: { start: Date; end: Date }
  filters: {
    types: TimeItemType[]
    priorities: Priority[]
    projects: string[]
    tags: string[]
  }

  // UI State
  isLoading: boolean
  error: string | null

  // Actions
  fetchTimeItems: (range: DateRange, scope: Scope) => Promise<void>
  createTimeItem: (item: CreateTimeItemInput) => Promise<TimeItem>
  updateTimeItem: (id: string, updates: Partial<TimeItem>) => Promise<TimeItem>
  deleteTimeItem: (id: string) => Promise<void>

  // Drag & Drop
  moveTimeItem: (id: string, newStart: Date, newEnd?: Date) => Promise<void>

  // Scope
  setScope: (scope: Scope) => void

  // Selection
  selectItem: (item: TimeItem | null) => void

  // Optimistic Updates
  optimisticUpdate: (id: string, updates: Partial<TimeItem>) => void
  rollbackUpdate: (id: string) => void
}

interface CalendarState {
  // Navigation
  currentDate: Date
  view: ViewType

  // Display
  hourStart: number        // e.g., 6 (6 AM)
  hourEnd: number          // e.g., 22 (10 PM)
  slotDuration: number     // e.g., 30 (minutes)
  weekStartsOn: 0 | 1      // Sunday or Monday

  // Energy zones
  morningEnd: number       // e.g., 12
  afternoonStart: number   // e.g., 14

  // Actions
  setView: (view: ViewType) => void
  navigateToDate: (date: Date) => void
  navigateRelative: (direction: 'prev' | 'next') => void
  goToToday: () => void
}

interface PreferencesState {
  // Energy settings
  peakHoursStart: number
  peakHoursEnd: number
  preferredPomodoroLength: number
  breakLength: number

  // Display
  showWeekends: boolean
  show24Hour: boolean
  defaultView: ViewType
  defaultScope: Scope

  // Notifications
  reminderDefaults: number[]  // minutes before

  // Actions
  updatePreferences: (prefs: Partial<PreferencesState>) => void
}
```

### 2.3 Component Architecture

#### TimeItem Component (Core)

```typescript
// components/scheduling/core/TimeItem.tsx

interface TimeItemProps {
  item: TimeItem
  variant: 'block' | 'card' | 'chip' | 'row'
  isSelected?: boolean
  isDragging?: boolean
  showTime?: boolean
  showScope?: boolean
  showPriority?: boolean
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

// Visual variants:
// - block: Calendar grid display (week/day view)
// - card: Detailed card with actions
// - chip: Compact pill (month view)
// - row: List item (agenda view)
```

#### Week View Architecture

```typescript
// components/scheduling/views/WeekView/WeekView.tsx

interface WeekViewProps {
  date: Date                    // Center date of the week
  scope: Scope
  onItemClick: (item: TimeItem) => void
  onSlotClick: (date: Date, hour: number) => void
  onItemMove: (item: TimeItem, newStart: Date) => void
}

// Internal structure:
// ┌─────────────────────────────────────────────────────────┐
// │ WeekHeader (day names, dates)                          │
// ├─────────────────────────────────────────────────────────┤
// │ ┌──────────┬──────────────────────────────────────────┐│
// │ │          │ TimeGrid                                 ││
// │ │ Tasks    │ ┌────────┬────────┬────────┬────────┐   ││
// │ │ Sidebar  │ │DayCol  │DayCol  │DayCol  │DayCol  │   ││
// │ │          │ │Mon     │Tue     │Wed     │Thu     │   ││
// │ │          │ │        │        │        │        │   ││
// │ │ [Drag    │ │[Items] │[Items] │[Items] │[Items] │   ││
// │ │  from    │ │        │        │        │        │   ││
// │ │  here]   │ └────────┴────────┴────────┴────────┘   ││
// │ └──────────┴──────────────────────────────────────────┘│
// └─────────────────────────────────────────────────────────┘
```

### 2.4 Drag & Drop Strategy

```typescript
// Using @dnd-kit

// Draggable sources:
// 1. TimeItems in calendar grid (rescheduling)
// 2. Tasks in sidebar (scheduling unscheduled tasks)
// 3. Tasks in kanban (status change)

// Droppable targets:
// 1. Calendar time slots (schedule/reschedule)
// 2. Kanban columns (status change)
// 3. Users/groups (sharing)
// 4. Dates in month view (move to date)

interface DragData {
  type: 'time-item' | 'unscheduled-task'
  item: TimeItem
  sourceView: ViewType
}

interface DropData {
  type: 'time-slot' | 'kanban-column' | 'user' | 'group' | 'date'
  date?: Date
  hour?: number
  columnId?: string
  userId?: string
  groupId?: string
}
```

---

## 3. Backend Architecture

### 3.1 Database Schema

```sql
-- Extend signapps-scheduler database

-- Main TimeItem table
CREATE TABLE scheduling.time_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('task', 'event', 'booking', 'shift', 'milestone', 'reminder', 'blocker')),

    -- Content
    title VARCHAR(500) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    color VARCHAR(20),

    -- Time
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    duration_minutes INTEGER,
    all_day BOOLEAN DEFAULT FALSE,

    -- Location
    location JSONB,  -- { type: 'text' | 'address', value: string, coordinates?: { lat, lng } }

    -- Organization hierarchy
    societe_id UUID NOT NULL REFERENCES identity.societes(id),
    business_unit_id UUID REFERENCES identity.business_units(id),
    service_id UUID REFERENCES identity.services(id),
    project_id UUID REFERENCES scheduling.projects(id),

    -- Ownership
    owner_id UUID NOT NULL REFERENCES identity.users(id),
    scope VARCHAR(10) NOT NULL DEFAULT 'moi' CHECK (scope IN ('moi', 'eux', 'nous')),
    visibility VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'group', 'service', 'bu', 'company', 'public')),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Energy & Productivity
    focus_level VARCHAR(10) CHECK (focus_level IN ('deep', 'medium', 'shallow', 'break')),
    energy_required VARCHAR(10) CHECK (energy_required IN ('high', 'medium', 'low')),
    value_score SMALLINT CHECK (value_score BETWEEN 1 AND 10),
    estimated_pomodoros SMALLINT,
    actual_pomodoros SMALLINT,
    preferred_time_of_day VARCHAR(10) CHECK (preferred_time_of_day IN ('morning', 'midday', 'afternoon', 'evening')),
    min_block_duration INTEGER,  -- minutes
    max_block_duration INTEGER,  -- minutes

    -- Relations
    parent_id UUID REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    template_id UUID REFERENCES scheduling.templates(id),

    -- Booking specific
    resource_id UUID REFERENCES scheduling.resources(id),
    booking_link VARCHAR(255),
    booking_rules JSONB,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES identity.users(id),

    -- Constraints
    CONSTRAINT valid_time_range CHECK (
        (start_time IS NULL AND end_time IS NULL) OR
        (start_time IS NOT NULL AND (end_time IS NULL OR end_time > start_time))
    )
);

-- Participants (users assigned to time items)
CREATE TABLE scheduling.time_item_users (
    time_item_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id),
    role VARCHAR(20) DEFAULT 'participant',  -- owner, participant, viewer
    PRIMARY KEY (time_item_id, user_id)
);

-- Group participants
CREATE TABLE scheduling.time_item_groups (
    time_item_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES identity.groups(id),
    PRIMARY KEY (time_item_id, group_id)
);

-- Dependencies between time items
CREATE TABLE scheduling.time_item_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    type VARCHAR(20) DEFAULT 'finish_to_start',  -- finish_to_start, start_to_start, etc.
    UNIQUE(item_id, depends_on_id)
);

-- Recurrence rules
CREATE TABLE scheduling.recurrence_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_item_id UUID NOT NULL REFERENCES scheduling.time_items(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL,  -- daily, weekly, monthly, yearly, custom
    interval_value INTEGER DEFAULT 1,
    days_of_week INTEGER[],  -- 0=Sunday, 1=Monday, etc.
    day_of_month INTEGER,
    month_of_year INTEGER,
    end_date TIMESTAMPTZ,
    occurrence_count INTEGER,
    exceptions TIMESTAMPTZ[] DEFAULT '{}'
);

-- Recurrence instances (materialized occurrences)
CREATE TABLE scheduling.recurrence_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES scheduling.recurrence_rules(id) ON DELETE CASCADE,
    original_start TIMESTAMPTZ NOT NULL,
    modified_start TIMESTAMPTZ,
    is_cancelled BOOLEAN DEFAULT FALSE,
    overrides JSONB  -- Any field overrides for this instance
);

-- Resources (rooms, equipment)
CREATE TABLE scheduling.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    societe_id UUID NOT NULL REFERENCES identity.societes(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),  -- room, equipment, vehicle, etc.
    capacity INTEGER,
    location VARCHAR(500),
    metadata JSONB,
    is_active BOOLEAN DEFAULT TRUE
);

-- Templates
CREATE TABLE scheduling.templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    societe_id UUID NOT NULL REFERENCES identity.societes(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    items JSONB NOT NULL,  -- Array of template items
    created_by UUID NOT NULL REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User preferences
CREATE TABLE scheduling.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES identity.users(id),
    peak_hours_start INTEGER DEFAULT 9,
    peak_hours_end INTEGER DEFAULT 12,
    pomodoro_length INTEGER DEFAULT 25,
    break_length INTEGER DEFAULT 5,
    show_weekends BOOLEAN DEFAULT TRUE,
    show_24_hour BOOLEAN DEFAULT FALSE,
    default_view VARCHAR(20) DEFAULT 'week',
    default_scope VARCHAR(10) DEFAULT 'moi',
    week_starts_on INTEGER DEFAULT 1,  -- 0=Sunday, 1=Monday
    reminder_defaults INTEGER[] DEFAULT '{15, 60}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_time_items_owner ON scheduling.time_items(owner_id);
CREATE INDEX idx_time_items_societe ON scheduling.time_items(societe_id);
CREATE INDEX idx_time_items_project ON scheduling.time_items(project_id);
CREATE INDEX idx_time_items_start ON scheduling.time_items(start_time);
CREATE INDEX idx_time_items_deadline ON scheduling.time_items(deadline);
CREATE INDEX idx_time_items_scope ON scheduling.time_items(scope);
CREATE INDEX idx_time_items_status ON scheduling.time_items(status);
CREATE INDEX idx_time_items_type ON scheduling.time_items(type);

-- Full text search
CREATE INDEX idx_time_items_search ON scheduling.time_items
    USING gin(to_tsvector('french', title || ' ' || COALESCE(description, '')));
```

### 3.2 API Endpoints

```
POST   /api/v1/scheduling/items              # Create time item
GET    /api/v1/scheduling/items              # List (with filters)
GET    /api/v1/scheduling/items/:id          # Get single item
PATCH  /api/v1/scheduling/items/:id          # Update item
DELETE /api/v1/scheduling/items/:id          # Delete item

POST   /api/v1/scheduling/items/:id/move     # Move (reschedule)
POST   /api/v1/scheduling/items/:id/share    # Share with users/groups
POST   /api/v1/scheduling/items/:id/clone    # Clone item

GET    /api/v1/scheduling/items/range        # Get items in date range
GET    /api/v1/scheduling/items/unscheduled  # Get unscheduled tasks

# Recurrence
POST   /api/v1/scheduling/items/:id/recurrence    # Set recurrence
DELETE /api/v1/scheduling/items/:id/recurrence    # Remove recurrence
PATCH  /api/v1/scheduling/items/:id/instances/:date  # Modify single instance

# Dependencies
POST   /api/v1/scheduling/items/:id/dependencies  # Add dependency
DELETE /api/v1/scheduling/items/:id/dependencies/:depId

# Templates
GET    /api/v1/scheduling/templates
POST   /api/v1/scheduling/templates
POST   /api/v1/scheduling/templates/:id/apply     # Apply template to date

# Resources
GET    /api/v1/scheduling/resources
GET    /api/v1/scheduling/resources/:id/availability

# Booking
GET    /api/v1/scheduling/booking/:slug/slots     # Public: get available slots
POST   /api/v1/scheduling/booking/:slug/book      # Public: book a slot

# AI
POST   /api/v1/scheduling/ai/suggest-schedule     # Get AI scheduling suggestions
POST   /api/v1/scheduling/ai/parse-natural        # Parse natural language input
GET    /api/v1/scheduling/ai/patterns             # Get user patterns

# Preferences
GET    /api/v1/scheduling/preferences
PATCH  /api/v1/scheduling/preferences
```

### 3.3 Query Filters

```typescript
interface TimeItemsQuery {
  // Date range (required)
  start: ISO8601
  end: ISO8601

  // Scope filter
  scope?: 'moi' | 'eux' | 'nous' | 'all'

  // Type filters
  types?: TimeItemType[]

  // Status filters
  statuses?: Status[]

  // Priority filters
  priorities?: Priority[]

  // Project filter
  project_id?: UUID

  // User/group filters
  user_ids?: UUID[]
  group_ids?: UUID[]

  // Include options
  include_recurrences?: boolean  // Expand recurrence instances
  include_completed?: boolean
  include_cancelled?: boolean

  // Pagination
  limit?: number
  offset?: number

  // Sort
  sort_by?: 'start_time' | 'deadline' | 'priority' | 'created_at'
  sort_order?: 'asc' | 'desc'
}
```

---

## 4. Key Algorithms

### 4.1 Overlap Detection

```typescript
// lib/scheduling/utils/overlap-calculator.ts

interface TimeSlot {
  start: Date
  end: Date
}

function detectOverlaps(items: TimeItem[]): OverlapGroup[] {
  // Sort by start time
  const sorted = [...items].sort((a, b) =>
    a.start_time.getTime() - b.start_time.getTime()
  )

  const groups: OverlapGroup[] = []
  let currentGroup: TimeItem[] = []
  let groupEnd: Date | null = null

  for (const item of sorted) {
    if (!groupEnd || item.start_time >= groupEnd) {
      // Start new group
      if (currentGroup.length > 0) {
        groups.push({ items: currentGroup, maxOverlap: currentGroup.length })
      }
      currentGroup = [item]
      groupEnd = item.end_time
    } else {
      // Add to current group
      currentGroup.push(item)
      if (item.end_time > groupEnd) {
        groupEnd = item.end_time
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push({ items: currentGroup, maxOverlap: currentGroup.length })
  }

  return groups
}

// Calculate column positions for overlapping items
function calculateColumns(group: OverlapGroup): Map<string, number> {
  const columns = new Map<string, number>()
  const columnEnds: Date[] = []

  for (const item of group.items) {
    // Find first available column
    let column = 0
    while (column < columnEnds.length && columnEnds[column] > item.start_time) {
      column++
    }

    columns.set(item.id, column)
    columnEnds[column] = item.end_time
  }

  return columns
}
```

### 4.2 Energy Zone Assignment

```typescript
// lib/scheduling/utils/energy-zones.ts

interface EnergyZoneConfig {
  morningStart: number    // e.g., 6
  morningEnd: number      // e.g., 12
  afternoonStart: number  // e.g., 14
  afternoonEnd: number    // e.g., 18
}

function getEnergyZone(hour: number, config: EnergyZoneConfig): EnergyLevel {
  if (hour >= config.morningStart && hour < config.morningEnd) {
    return 'high'   // Peak morning energy
  }
  if (hour >= config.morningEnd && hour < config.afternoonStart) {
    return 'medium' // Midday
  }
  if (hour >= config.afternoonStart && hour < config.afternoonEnd) {
    return 'low'    // Afternoon dip
  }
  return 'shallow'  // Early morning or evening
}

function suggestTimeForTask(task: TimeItem, availableSlots: TimeSlot[]): TimeSlot | null {
  const taskEnergy = task.energy_required || 'medium'

  // Sort slots by energy match
  const scored = availableSlots.map(slot => ({
    slot,
    score: calculateEnergyMatch(slot, taskEnergy)
  }))

  scored.sort((a, b) => b.score - a.score)

  return scored[0]?.slot || null
}
```

### 4.3 Natural Language Parsing

```typescript
// lib/scheduling/utils/natural-language.ts

interface ParsedInput {
  title: string
  type?: TimeItemType
  date?: Date
  time?: { hour: number; minute: number }
  duration?: number
  priority?: Priority
  participants?: string[]
  location?: string
}

function parseNaturalLanguage(input: string): ParsedInput {
  const result: ParsedInput = { title: input }

  // Date patterns (French)
  const datePatterns = [
    { regex: /demain/i, resolver: () => addDays(new Date(), 1) },
    { regex: /après-demain/i, resolver: () => addDays(new Date(), 2) },
    { regex: /lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/i, resolver: matchDay },
    { regex: /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/, resolver: matchDate },
  ]

  // Time patterns
  const timePatterns = [
    { regex: /(\d{1,2})[h:](\d{2})?/i, extract: (m) => ({ hour: +m[1], minute: +(m[2] || 0) }) },
    { regex: /midi/i, extract: () => ({ hour: 12, minute: 0 }) },
  ]

  // Priority patterns
  const priorityPatterns = [
    { regex: /urgent|haute priorité|important/i, priority: 'urgent' as Priority },
    { regex: /priorité (haute|moyenne|basse)/i, extract: matchPriority },
  ]

  // Type patterns
  const typePatterns = [
    { regex: /réunion|meeting|rendez-vous/i, type: 'event' as TimeItemType },
    { regex: /tâche|task|todo/i, type: 'task' as TimeItemType },
  ]

  // Apply patterns and extract
  for (const pattern of [...datePatterns, ...timePatterns, ...priorityPatterns, ...typePatterns]) {
    // ... pattern matching logic
  }

  // Clean title (remove matched patterns)
  result.title = cleanTitle(input)

  return result
}
```

---

## 5. Security Architecture

### 5.1 Access Control

```typescript
// Visibility rules enforced at API level

function canAccess(user: User, item: TimeItem): boolean {
  // Owner always has access
  if (item.owner_id === user.id) return true

  // Check direct user assignment
  if (item.users.includes(user.id)) return true

  // Check group assignment
  if (item.groups.some(g => user.groups.includes(g))) return true

  // Check visibility level
  switch (item.visibility) {
    case 'private':
      return false
    case 'group':
      return user.groups.some(g => item.groups.includes(g))
    case 'service':
      return user.service_id === item.service_id
    case 'bu':
      return user.business_unit_id === item.business_unit_id
    case 'company':
      return user.societe_id === item.societe_id
    case 'public':
      return true
  }
}

function canEdit(user: User, item: TimeItem): boolean {
  if (item.owner_id === user.id) return true

  // Check if user has edit role
  const userRole = item.user_roles?.[user.id]
  return userRole === 'owner' || userRole === 'editor'
}
```

### 5.2 Cross-Société Sharing

```typescript
// External sharing requires explicit permission

interface ExternalShare {
  item_id: UUID
  source_societe_id: UUID
  target_societe_id: UUID
  target_users?: UUID[]
  target_groups?: UUID[]
  permissions: 'view' | 'edit'
  expires_at?: Date
}

// Validate external share
function validateExternalShare(share: ExternalShare, user: User): boolean {
  // User must be owner of item
  // Target société must be in allowed federation list
  // Permissions must not exceed source permissions
}
```

---

## 6. Performance Optimizations

### 6.1 Frontend

- **Virtual scrolling** for agenda view with 1000+ items
- **Lazy loading** of views (code splitting per view)
- **Optimistic updates** for drag-drop (update UI before API)
- **Debounced search** (300ms)
- **Memoization** of overlap calculations
- **Windowed rendering** for week/day grids

### 6.2 Backend

- **Database indexes** on frequently queried columns
- **Materialized recurrence instances** (pre-expand for performance)
- **Query caching** with TTL for repeated date range queries
- **Pagination** for list endpoints
- **Bulk operations** for template application

### 6.3 Data Fetching Strategy

```typescript
// Prefetch strategy for smooth navigation

function prefetchAdjacentRanges(currentDate: Date, view: ViewType) {
  const ranges = getAdjacentRanges(currentDate, view)

  // Prefetch previous and next range
  queryClient.prefetchQuery(['timeItems', ranges.prev], fetchTimeItems)
  queryClient.prefetchQuery(['timeItems', ranges.next], fetchTimeItems)
}
```

---

## 7. Mobile Responsiveness

### 7.1 Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | <640px | Single column, bottom nav |
| Tablet | 640-1023px | Adapted grid, collapsible sidebar |
| Desktop | ≥1024px | Full layout with sidebar |

### 7.2 Mobile-Specific Features

- **Swipe gestures** for navigation
- **Bottom sheet** for item details
- **FAB** for quick create
- **Pull-to-refresh**
- **Simplified views** (agenda preferred on mobile)

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Overlap calculation algorithms
- Energy zone logic
- Natural language parsing
- Date utilities

### 8.2 Integration Tests

- API endpoints
- Database queries
- Permission enforcement

### 8.3 E2E Tests (Playwright)

- Create/edit/delete time items
- Drag-drop rescheduling
- View navigation
- Scope switching
- Booking flow

---

## 9. Implementation Phases

| Phase | Scope | Components |
|-------|-------|------------|
| **1** | Week View MVP | TimeItem, WeekView, ScopeSwitch, Basic CRUD |
| **2** | Complete Calendar | DayView, MonthView, AgendaView |
| **3** | Productivity | SmartInput, DayPlanner, Pomodoro |
| **4** | Team Features | HeatmapView, Booking, Sharing |
| **5** | Projects | TimelineView, KanbanView, Dependencies |
| **6** | AI | AutoSchedule, Patterns, Suggestions |
| **7** | HR | RosterView, Shifts |

---

**Document Status:** ✅ APPROVED FOR DEVELOPMENT
**Next Step:** Epics & Stories
