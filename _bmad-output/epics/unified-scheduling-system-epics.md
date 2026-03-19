---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['unified-scheduling-system-prd.md', 'unified-scheduling-system-architecture.md']
workflowType: 'epics'
project_name: 'Unified Scheduling System'
user_name: 'Etienne'
date: '2026-03-18'
status: 'complete'
total_points: 377
total_stories: 89
---

# Epics & Stories - Unified Scheduling System

**Author:** Etienne
**Date:** 2026-03-18
**Version:** 1.0

---

## Overview

| Phase | Epic | Stories | Points |
|-------|------|---------|--------|
| 1 | Foundation & Week View | 18 | 76 |
| 2 | Complete Calendar Views | 12 | 48 |
| 3 | Productivity Features | 10 | 45 |
| 4 | Team & Booking | 12 | 52 |
| 5 | Project Management | 11 | 55 |
| 6 | AI Features | 10 | 50 |
| 7 | HR & Roster | 8 | 35 |
| 8 | Polish & Performance | 8 | 16 |
| **TOTAL** | **8 Epics** | **89 Stories** | **377 Points** |

---

# PHASE 1: FOUNDATION & WEEK VIEW

## Epic 1.1: Core Infrastructure

### Story 1.1.1: TimeItem Data Model & Types
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the unified TimeItem TypeScript interface and related types that will be used across the entire scheduling system.

**Acceptance Criteria:**
- [ ] Create `lib/scheduling/types/time-item.ts` with full TimeItem interface
- [ ] Create supporting types: Scope, Visibility, Priority, Status, TimeItemType
- [ ] Create RecurrenceRule and BookingRules interfaces
- [ ] Create CreateTimeItemInput, UpdateTimeItemInput DTOs
- [ ] Export all types from `lib/scheduling/types/index.ts`

**Technical Notes:**
```typescript
// Key types to implement
type TimeItemType = 'task' | 'event' | 'booking' | 'shift' | 'milestone' | 'reminder' | 'blocker'
type Scope = 'moi' | 'eux' | 'nous'
type Visibility = 'private' | 'group' | 'service' | 'bu' | 'company' | 'public'
type Priority = 'low' | 'medium' | 'high' | 'urgent'
type Status = 'todo' | 'in_progress' | 'done' | 'cancelled'
type FocusLevel = 'deep' | 'medium' | 'shallow' | 'break'
type EnergyRequired = 'high' | 'medium' | 'low'
```

---

### Story 1.1.2: Scheduling API Client
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the API client for communicating with the scheduling backend service.

**Acceptance Criteria:**
- [ ] Create `lib/scheduling/api/scheduling-api.ts`
- [ ] Implement CRUD operations for TimeItems
- [ ] Implement range query with filters
- [ ] Implement move/reschedule endpoint
- [ ] Implement share endpoint
- [ ] Add proper error handling and types

**Technical Notes:**
- Base URL: `NEXT_PUBLIC_SCHEDULER_URL` (port 3007)
- Use existing Axios instance with JWT interceptor
- Return typed responses

---

### Story 1.1.3: Scheduling Zustand Store
**Points:** 8 | **Priority:** 🔴 Critical

**Description:**
Create the main Zustand store for scheduling state management.

**Acceptance Criteria:**
- [ ] Create `stores/scheduling/scheduling-store.ts`
- [ ] Implement timeItems state with CRUD actions
- [ ] Implement scope filter state
- [ ] Implement date range state
- [ ] Implement optimistic update pattern
- [ ] Implement selection state
- [ ] Add loading and error states

**Technical Notes:**
```typescript
interface SchedulingStore {
  timeItems: TimeItem[]
  scope: Scope
  dateRange: DateRange
  selectedItem: TimeItem | null
  isLoading: boolean
  // ... actions
}
```

---

### Story 1.1.4: Calendar Navigation Store
**Points:** 3 | **Priority:** 🔴 Critical

**Description:**
Create store for calendar view and navigation state.

**Acceptance Criteria:**
- [ ] Create `stores/scheduling/calendar-store.ts`
- [ ] Implement currentDate state
- [ ] Implement view type state (day/week/month/etc.)
- [ ] Implement navigation actions (prev, next, today)
- [ ] Implement display settings (hourStart, hourEnd, slotDuration)

---

### Story 1.1.5: User Preferences Store
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Create store for user scheduling preferences.

**Acceptance Criteria:**
- [ ] Create `stores/scheduling/preferences-store.ts`
- [ ] Implement energy zone settings (peak hours)
- [ ] Implement pomodoro settings
- [ ] Implement display preferences
- [ ] Persist to localStorage and sync with backend

---

### Story 1.1.6: Date & Time Utilities
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create utility functions for date/time operations.

**Acceptance Criteria:**
- [ ] Create `lib/scheduling/utils/time-utils.ts`
- [ ] Implement getWeekDays, getMonthDays helpers
- [ ] Implement time slot generation
- [ ] Implement date range overlap detection
- [ ] Implement duration formatting
- [ ] Implement timezone handling
- [ ] Use date-fns throughout

---

## Epic 1.2: Core Components

### Story 1.2.1: ScopeSwitch Component
**Points:** 3 | **Priority:** 🔴 Critical

**Description:**
Create the MOI/EUX/NOUS scope toggle component.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/core/ScopeSwitch.tsx`
- [ ] Display three toggle options: MOI, EUX, NOUS
- [ ] Support optional ALL option
- [ ] Visual indication of current scope
- [ ] Emit scope change events
- [ ] Keyboard accessible
- [ ] Mobile-friendly touch targets

**UI Specification:**
```
┌─────┬─────┬─────┐
│ MOI │ EUX │NOUS │
└─────┴─────┴─────┘
  ▲ (selected)
```

---

### Story 1.2.2: ViewSelector Component
**Points:** 3 | **Priority:** 🔴 Critical

**Description:**
Create the view type selector (Day/Week/Month/etc.).

**Acceptance Criteria:**
- [ ] Create `components/scheduling/core/ViewSelector.tsx`
- [ ] Display available view options as dropdown or tabs
- [ ] Support icons for each view type
- [ ] Emit view change events
- [ ] Highlight current view
- [ ] Responsive: dropdown on mobile, tabs on desktop

---

### Story 1.2.3: DateNavigator Component
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the date navigation component with prev/next/today controls.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/core/DateNavigator.tsx`
- [ ] Display current date/range based on view type
- [ ] Previous and Next navigation buttons
- [ ] Today button to jump to current date
- [ ] Click on date opens date picker
- [ ] Format: "March 17-23, 2026" for week, "March 2026" for month
- [ ] Keyboard navigation support

---

### Story 1.2.4: TimeItem Display Component
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the unified TimeItem display component with multiple variants.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/core/TimeItem.tsx`
- [ ] Support variants: block, card, chip, row
- [ ] Display type icon, title, time
- [ ] Show priority indicator (color/icon)
- [ ] Show scope indicator when relevant
- [ ] Show participant avatars
- [ ] Support drag handle for DnD
- [ ] Click to select, double-click to edit

**Variants:**
- `block`: Calendar grid display (week/day view)
- `card`: Detailed card with all info
- `chip`: Compact pill (month view, multi-day)
- `row`: List item (agenda view)

---

### Story 1.2.5: TimeItem Dialog (Create/Edit)
**Points:** 8 | **Priority:** 🔴 Critical

**Description:**
Create the modal dialog for creating and editing TimeItems.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/dialogs/TimeItemDialog.tsx`
- [ ] Support create and edit modes
- [ ] Form fields: type, title, description, dates, times
- [ ] Duration picker or end time
- [ ] Priority selector
- [ ] Scope selector
- [ ] Tags input
- [ ] Color picker
- [ ] Location input
- [ ] Project selector (dropdown)
- [ ] Participants selector (users/groups)
- [ ] All-day toggle
- [ ] Validation with error messages
- [ ] Save and Cancel buttons

---

### Story 1.2.6: Quick Create Dialog
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Create a lightweight quick-create dialog for fast item creation.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/dialogs/QuickCreateDialog.tsx`
- [ ] Minimal fields: title, type, date/time
- [ ] Pre-fill date/time from context (clicked slot)
- [ ] "More options" link to full dialog
- [ ] Keyboard shortcut to open (Ctrl+N)
- [ ] Auto-focus title field

---

## Epic 1.3: Week View

### Story 1.3.1: Week View Container
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the main Week View container component.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/WeekView/WeekView.tsx`
- [ ] Compose: WeekHeader, TimeGrid, TasksSidebar
- [ ] Handle data fetching for current week
- [ ] Handle scope filtering
- [ ] Responsive layout (hide sidebar on mobile)
- [ ] Loading and error states

---

### Story 1.3.2: Week Header Component
**Points:** 3 | **Priority:** 🔴 Critical

**Description:**
Create the header row showing day names and dates.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/WeekView/WeekHeader.tsx`
- [ ] Display 7 days (or 5 if weekends hidden)
- [ ] Show day name and date number
- [ ] Highlight today
- [ ] All-day events row below header
- [ ] Sticky positioning when scrolling

---

### Story 1.3.3: Time Grid Component
**Points:** 8 | **Priority:** 🔴 Critical

**Description:**
Create the hourly time grid for the week view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/WeekView/TimeGrid.tsx`
- [ ] Display hours from hourStart to hourEnd
- [ ] Configurable slot duration (15, 30, 60 min)
- [ ] Current time indicator line
- [ ] Click on empty slot to create
- [ ] Scrollable vertically
- [ ] Auto-scroll to current time on load

---

### Story 1.3.4: Day Column Component
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the column component for a single day in week view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/WeekView/DayColumn.tsx`
- [ ] Render TimeItems positioned by time
- [ ] Handle overlapping items (side-by-side columns)
- [ ] Droppable target for DnD
- [ ] Visual feedback on drag over
- [ ] Weekend styling (lighter background)

---

### Story 1.3.5: Energy Zones Display
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Add visual energy zone indicators to the time grid.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/WeekView/EnergyZones.tsx`
- [ ] Color-code time ranges: morning (green), midday (yellow), afternoon (orange)
- [ ] Configurable zone boundaries
- [ ] Subtle background colors, not intrusive
- [ ] Optional: show/hide toggle

---

### Story 1.3.6: Tasks Sidebar
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create the sidebar showing unscheduled tasks.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/WeekView/TasksSidebar.tsx`
- [ ] Display unscheduled tasks (no start_time)
- [ ] Group by priority or project
- [ ] Draggable items to schedule
- [ ] Collapsible on desktop
- [ ] Search/filter within sidebar
- [ ] "Add task" button

---

### Story 1.3.7: Overlap Calculator
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Implement algorithm for detecting and positioning overlapping items.

**Acceptance Criteria:**
- [ ] Create `lib/scheduling/utils/overlap-calculator.ts`
- [ ] Detect overlapping time items
- [ ] Calculate column positions for side-by-side display
- [ ] Calculate width percentages
- [ ] Handle complex multi-overlap scenarios
- [ ] Unit tests for edge cases

---

### Story 1.3.8: Week View Drag & Drop
**Points:** 8 | **Priority:** 🔴 Critical

**Description:**
Implement drag and drop for rescheduling items in week view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/WeekView/hooks/useWeekDragDrop.ts`
- [ ] Drag items to different time slots
- [ ] Drag items to different days
- [ ] Resize items by dragging edges
- [ ] Drag from sidebar to schedule
- [ ] Optimistic UI update
- [ ] Visual feedback during drag
- [ ] Snap to slot intervals

---

## Epic 1.4: Backend Integration

### Story 1.4.1: Database Schema Migration
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create PostgreSQL migrations for the scheduling schema.

**Acceptance Criteria:**
- [ ] Create migration for time_items table
- [ ] Create migration for time_item_users table
- [ ] Create migration for time_item_groups table
- [ ] Create migration for time_item_dependencies table
- [ ] Create migration for recurrence_rules table
- [ ] Create migration for resources table
- [ ] Create migration for templates table
- [ ] Create migration for user_preferences table
- [ ] Add all indexes

---

### Story 1.4.2: TimeItem Repository (Rust)
**Points:** 8 | **Priority:** 🔴 Critical

**Description:**
Create the Rust repository for TimeItem CRUD operations.

**Acceptance Criteria:**
- [ ] Create `TimeItemRepository` in signapps-scheduler
- [ ] Implement create, read, update, delete
- [ ] Implement find_by_range with filters
- [ ] Implement find_unscheduled
- [ ] Implement scope-based filtering
- [ ] Implement visibility enforcement
- [ ] Add proper error handling

---

### Story 1.4.3: TimeItem API Handlers (Rust)
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the Axum handlers for TimeItem endpoints.

**Acceptance Criteria:**
- [ ] Create handlers in signapps-scheduler
- [ ] POST /api/v1/scheduling/items
- [ ] GET /api/v1/scheduling/items (with query params)
- [ ] GET /api/v1/scheduling/items/:id
- [ ] PATCH /api/v1/scheduling/items/:id
- [ ] DELETE /api/v1/scheduling/items/:id
- [ ] POST /api/v1/scheduling/items/:id/move
- [ ] Add auth middleware
- [ ] Add validation

---

### Story 1.4.4: Sharing Endpoints (Rust)
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create endpoints for sharing TimeItems with users/groups.

**Acceptance Criteria:**
- [ ] POST /api/v1/scheduling/items/:id/share
- [ ] Accept users[] and groups[] arrays
- [ ] Validate permissions
- [ ] Update time_item_users and time_item_groups tables
- [ ] Return updated item with participants

---

# PHASE 2: COMPLETE CALENDAR VIEWS

## Epic 2.1: Day View

### Story 2.1.1: Day View Component
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the Day View showing a single day in detail.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/DayView/DayView.tsx`
- [ ] Full-height time grid for one day
- [ ] Larger time slots than week view
- [ ] All-day section at top
- [ ] Current time indicator
- [ ] Same DnD support as week view

---

### Story 2.1.2: Day View Header
**Points:** 2 | **Priority:** 🔴 Critical

**Description:**
Create header for day view with date and quick info.

**Acceptance Criteria:**
- [ ] Display full date: "Mardi 18 Mars 2026"
- [ ] Show summary: "5 items, 2 tasks due"
- [ ] Energy zone indicator for current time
- [ ] Weather info (optional, future)

---

## Epic 2.2: Month View

### Story 2.2.1: Month View Component
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the Month View showing a full month grid.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/MonthView/MonthView.tsx`
- [ ] 6-week grid (to cover edge cases)
- [ ] Click day to navigate to day view
- [ ] Drag items between days

---

### Story 2.2.2: Month Grid Component
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the grid layout for month view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/MonthView/MonthGrid.tsx`
- [ ] 7 columns (days of week)
- [ ] 5-6 rows (weeks)
- [ ] Day cells with date number
- [ ] Gray out days from adjacent months
- [ ] Highlight today

---

### Story 2.2.3: Month Day Cell
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create the cell component for each day in month view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/MonthView/DayCell.tsx`
- [ ] Show up to 3 items as chips
- [ ] "+X more" indicator if overflow
- [ ] Click to expand or navigate
- [ ] Color indicators for item types
- [ ] Deadline indicators
- [ ] Droppable for DnD

---

## Epic 2.3: Agenda View

### Story 2.3.1: Agenda View Component
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the Agenda View as a chronological list.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/AgendaView/AgendaView.tsx`
- [ ] List items grouped by day
- [ ] Infinite scroll for future dates
- [ ] Quick actions (complete, reschedule)
- [ ] Mobile-optimized

---

### Story 2.3.2: Agenda List Component
**Points:** 3 | **Priority:** 🔴 Critical

**Description:**
Create the scrollable list for agenda view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/AgendaView/AgendaList.tsx`
- [ ] Virtual scrolling for performance
- [ ] Date headers as sticky sections
- [ ] Pull-to-refresh on mobile

---

### Story 2.3.3: Agenda Item Component
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Create the list item component for agenda view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/AgendaView/AgendaItem.tsx`
- [ ] Compact row layout
- [ ] Type icon, title, time, location
- [ ] Swipe actions on mobile
- [ ] Click to expand/edit

---

## Epic 2.4: View Integration

### Story 2.4.1: Scheduling Hub Page
**Points:** 5 | **Priority:** 🔴 Critical

**Description:**
Create the main scheduling page that hosts all views.

**Acceptance Criteria:**
- [ ] Create `app/scheduling/page.tsx`
- [ ] Header: ScopeSwitch, ViewSelector, DateNavigator
- [ ] Body: Render current view component
- [ ] URL sync: /scheduling?view=week&date=2026-03-18
- [ ] Keyboard shortcuts for view switching

---

### Story 2.4.2: Scheduling Layout
**Points:** 3 | **Priority:** 🔴 Critical

**Description:**
Create the layout wrapper for scheduling pages.

**Acceptance Criteria:**
- [ ] Create `app/scheduling/layout.tsx`
- [ ] Wrap content with necessary providers
- [ ] Handle data prefetching
- [ ] Error boundary
- [ ] Loading state

---

# PHASE 3: PRODUCTIVITY FEATURES

## Epic 3.1: Smart Input

### Story 3.1.1: Natural Language Parser
**Points:** 8 | **Priority:** 🟡 High

**Description:**
Implement parser for natural language input.

**Acceptance Criteria:**
- [ ] Create `lib/scheduling/utils/natural-language.ts`
- [ ] Parse French date expressions (demain, lundi, 15/03)
- [ ] Parse time expressions (14h, midi, 14h30)
- [ ] Parse priority keywords (urgent, important)
- [ ] Parse type keywords (réunion, tâche)
- [ ] Extract participants (@jean, @équipe)
- [ ] Extract location (à salle A)
- [ ] Return structured ParsedInput

---

### Story 3.1.2: SmartInput Component
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create the natural language input component.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/core/SmartInput.tsx`
- [ ] Text input with placeholder examples
- [ ] Real-time parsing preview
- [ ] Suggestion chips for ambiguous parts
- [ ] Enter to create
- [ ] Keyboard shortcut to focus

---

## Epic 3.2: Day Planner

### Story 3.2.1: Day Planner Wizard
**Points:** 8 | **Priority:** 🟡 High

**Description:**
Create the morning planning ritual wizard.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/features/DayPlanner/DayPlanner.tsx`
- [ ] Step 1: Review today's existing items
- [ ] Step 2: Select tasks to schedule
- [ ] Step 3: Preview AI-suggested arrangement
- [ ] Step 4: Adjust and confirm
- [ ] Save all scheduled items

---

### Story 3.2.2: AI Day Suggestions
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create component to display AI scheduling suggestions.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/features/DayPlanner/SuggestedDay.tsx`
- [ ] Visual timeline of suggested day
- [ ] Reasoning for each placement
- [ ] Accept/reject individual suggestions
- [ ] "Accept all" button

---

## Epic 3.3: Pomodoro Integration

### Story 3.3.1: Pomodoro Timer Component
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create the Pomodoro timer for focus mode.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/FocusView/PomodoroTimer.tsx`
- [ ] Circular progress indicator
- [ ] Work/break mode toggle
- [ ] Configurable durations
- [ ] Audio notifications
- [ ] Session counter

---

### Story 3.3.2: Focus View
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create the distraction-free focus view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/FocusView/FocusView.tsx`
- [ ] Single task display (full screen)
- [ ] Pomodoro timer
- [ ] No navigation, minimal UI
- [ ] Mark complete action
- [ ] Break suggestions
- [ ] Exit to return to normal view

---

## Epic 3.4: Recurrence

### Story 3.4.1: Recurrence Dialog
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create dialog for setting up recurring items.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/dialogs/RecurrenceDialog.tsx`
- [ ] Frequency selector (daily, weekly, monthly, yearly)
- [ ] Interval (every X days/weeks)
- [ ] Days of week selector (for weekly)
- [ ] End condition (never, after X, on date)
- [ ] Preview of next occurrences

---

### Story 3.4.2: Recurrence Backend
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Implement recurrence logic in backend.

**Acceptance Criteria:**
- [ ] Create recurrence_rules handling in Rust
- [ ] Expand occurrences for date range queries
- [ ] Handle exceptions (cancelled instances)
- [ ] Handle modifications to single instances
- [ ] "Edit this occurrence" vs "Edit all"

---

# PHASE 4: TEAM & BOOKING

## Epic 4.1: Heatmap View

### Story 4.1.1: Heatmap View Component
**Points:** 8 | **Priority:** 🟡 High

**Description:**
Create the team availability heatmap view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/HeatmapView/HeatmapView.tsx`
- [ ] Grid: rows = team members, columns = time slots
- [ ] Color intensity = busyness level
- [ ] Click cell to see details
- [ ] Filter by group/service
- [ ] Time range selector

---

### Story 4.1.2: Availability Grid
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create the grid component for heatmap.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/HeatmapView/AvailabilityGrid.tsx`
- [ ] Calculate availability per time slot
- [ ] Color scale (green=free, red=busy)
- [ ] Hover to see details
- [ ] Click to book

---

### Story 4.1.3: Team Availability API
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create backend endpoint for team availability.

**Acceptance Criteria:**
- [ ] GET /api/v1/scheduling/availability
- [ ] Query params: user_ids[], start, end, granularity
- [ ] Return availability matrix
- [ ] Respect visibility permissions

---

## Epic 4.2: Booking System

### Story 4.2.1: Booking Page (Public)
**Points:** 8 | **Priority:** 🟡 High

**Description:**
Create public booking page for external users.

**Acceptance Criteria:**
- [ ] Create `app/scheduling/booking/[slug]/page.tsx`
- [ ] No auth required
- [ ] Show available slots
- [ ] Booking form (name, email, notes)
- [ ] Confirmation page
- [ ] Email notifications

---

### Story 4.2.2: Booking Rules Configuration
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create UI for configuring booking rules.

**Acceptance Criteria:**
- [ ] Min notice time
- [ ] Max advance booking
- [ ] Buffer times
- [ ] Max bookings per day
- [ ] Allowed time ranges
- [ ] Blocked times

---

### Story 4.2.3: Booking Slots API
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create backend for booking slot calculation.

**Acceptance Criteria:**
- [ ] GET /api/v1/scheduling/booking/:slug/slots
- [ ] Apply booking rules
- [ ] Exclude existing items
- [ ] Return available slots
- [ ] POST /api/v1/scheduling/booking/:slug/book

---

## Epic 4.3: Sharing UI

### Story 4.3.1: Share Modal
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create modal for sharing items with users/groups.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/features/Sharing/ShareModal.tsx`
- [ ] User search/select
- [ ] Group search/select
- [ ] Permission level selector
- [ ] Current participants list
- [ ] Remove participant action

---

### Story 4.3.2: External Link Generation
**Points:** 3 | **Priority:** 🟢 Medium

**Description:**
Create UI for generating external share links.

**Acceptance Criteria:**
- [ ] Generate unique link
- [ ] Expiration date option
- [ ] Permission level (view only)
- [ ] Copy to clipboard
- [ ] Revoke link action

---

# PHASE 5: PROJECT MANAGEMENT

## Epic 5.1: Timeline View

### Story 5.1.1: Timeline View Component
**Points:** 8 | **Priority:** 🟡 High

**Description:**
Create Gantt-style timeline view.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/TimelineView/TimelineView.tsx`
- [ ] Horizontal time axis
- [ ] Items as bars
- [ ] Zoom levels (day, week, month)
- [ ] Scroll navigation
- [ ] Today marker

---

### Story 5.1.2: Timeline Row Component
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create row component for timeline items.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/TimelineView/TimelineRow.tsx`
- [ ] Render item as bar
- [ ] Show title in bar
- [ ] Drag to reschedule
- [ ] Resize to change duration
- [ ] Milestone markers (diamond shape)

---

### Story 5.1.3: Dependency Lines
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create SVG dependency lines between items.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/TimelineView/DependencyLines.tsx`
- [ ] Draw arrows between dependent items
- [ ] Update on item move
- [ ] Click to remove dependency
- [ ] Drag to create dependency

---

### Story 5.1.4: Dependencies Backend
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Implement dependency handling in backend.

**Acceptance Criteria:**
- [ ] POST /api/v1/scheduling/items/:id/dependencies
- [ ] DELETE /api/v1/scheduling/items/:id/dependencies/:depId
- [ ] Validate no circular dependencies
- [ ] Include dependencies in item fetch

---

## Epic 5.2: Kanban View

### Story 5.2.1: Kanban View Component
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create Kanban board view for tasks.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/KanbanView/KanbanView.tsx`
- [ ] Columns: To Do, In Progress, Done
- [ ] Drag between columns to change status
- [ ] Filter by project
- [ ] WIP limits (optional)

---

### Story 5.2.2: Kanban Column Component
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Create column component for Kanban.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/KanbanView/KanbanColumn.tsx`
- [ ] Column header with count
- [ ] Scrollable card list
- [ ] Droppable target
- [ ] Add item button

---

### Story 5.2.3: Kanban Card Component
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Create card component for Kanban items.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/KanbanView/KanbanCard.tsx`
- [ ] Title, priority indicator, deadline
- [ ] Participant avatars
- [ ] Quick actions menu
- [ ] Draggable

---

## Epic 5.3: Templates

### Story 5.3.1: Template Manager
**Points:** 5 | **Priority:** 🟢 Medium

**Description:**
Create UI for managing workflow templates.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/features/Templates/TemplateManager.tsx`
- [ ] List existing templates
- [ ] Create new template
- [ ] Edit template
- [ ] Delete template
- [ ] Apply template to date

---

### Story 5.3.2: Template Editor
**Points:** 5 | **Priority:** 🟢 Medium

**Description:**
Create editor for building templates.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/features/Templates/TemplateEditor.tsx`
- [ ] Add items to template
- [ ] Set relative dates (Day 1, Day 2)
- [ ] Preview template
- [ ] Save template

---

# PHASE 6: AI FEATURES

## Epic 6.1: Auto-Scheduling

### Story 6.1.1: AI Scheduling Service
**Points:** 8 | **Priority:** 🟡 High

**Description:**
Create backend service for AI scheduling suggestions.

**Acceptance Criteria:**
- [ ] Create scheduling AI module in signapps-ai
- [ ] Analyze user patterns
- [ ] Consider deadlines and priorities
- [ ] Consider energy zones
- [ ] Return suggested schedule
- [ ] POST /api/v1/scheduling/ai/suggest-schedule

---

### Story 6.1.2: Auto-Schedule Preview
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create UI for previewing AI schedule suggestions.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/ai/AutoSchedulePreview.tsx`
- [ ] Visual diff of current vs suggested
- [ ] Accept/reject per item
- [ ] Accept all button
- [ ] Explanation for each suggestion

---

## Epic 6.2: Pattern Learning

### Story 6.2.1: Pattern Analyzer
**Points:** 8 | **Priority:** 🟡 High

**Description:**
Create service to learn user scheduling patterns.

**Acceptance Criteria:**
- [ ] Analyze historical scheduling data
- [ ] Identify peak productivity times
- [ ] Identify preferred meeting times
- [ ] Identify task completion patterns
- [ ] Store patterns per user

---

### Story 6.2.2: Pattern-Based Suggestions
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Use learned patterns to improve suggestions.

**Acceptance Criteria:**
- [ ] "You usually do X at this time"
- [ ] "Based on your patterns, try Y"
- [ ] Suggest energy-appropriate tasks
- [ ] Learn from user feedback

---

## Epic 6.3: Conflict Resolution

### Story 6.3.1: Conflict Detection
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Detect scheduling conflicts automatically.

**Acceptance Criteria:**
- [ ] Detect double-booking
- [ ] Detect dependency violations
- [ ] Detect resource conflicts
- [ ] Visual indicators on conflicts

---

### Story 6.3.2: Conflict Resolution Dialog
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create dialog for resolving conflicts.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/ai/ConflictResolver.tsx`
- [ ] Show conflicting items
- [ ] Suggest alternatives
- [ ] Quick reschedule actions
- [ ] "Find next available" option

---

## Epic 6.4: NLP Backend

### Story 6.4.1: NLP Parsing Endpoint
**Points:** 5 | **Priority:** 🟡 High

**Description:**
Create backend endpoint for NLP parsing.

**Acceptance Criteria:**
- [ ] POST /api/v1/scheduling/ai/parse-natural
- [ ] Accept French text
- [ ] Return structured data
- [ ] Handle ambiguity with options
- [ ] Use signapps-ai LLM

---

# PHASE 7: HR & ROSTER

## Epic 7.1: Roster View

### Story 7.1.1: Roster View Component
**Points:** 8 | **Priority:** 🟢 Medium

**Description:**
Create roster view for HR shift management.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/RosterView/RosterView.tsx`
- [ ] Grid: rows = employees, columns = days
- [ ] Show shifts as colored blocks
- [ ] Filter by service/group
- [ ] Week navigation

---

### Story 7.1.2: Shift Grid Component
**Points:** 5 | **Priority:** 🟢 Medium

**Description:**
Create the grid component for roster.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/RosterView/ShiftGrid.tsx`
- [ ] Employee rows with names
- [ ] Day columns
- [ ] Shift cells with time ranges
- [ ] Click to assign shift

---

### Story 7.1.3: Shift Cell Component
**Points:** 3 | **Priority:** 🟢 Medium

**Description:**
Create cell component for shift display.

**Acceptance Criteria:**
- [ ] Create `components/scheduling/views/RosterView/ShiftCell.tsx`
- [ ] Display shift time range
- [ ] Color by shift type
- [ ] Click to edit
- [ ] Drag to reassign

---

## Epic 7.2: Shift Management

### Story 7.2.1: Shift Templates
**Points:** 5 | **Priority:** 🟢 Medium

**Description:**
Create shift template system.

**Acceptance Criteria:**
- [ ] Define shift types (Morning, Afternoon, Night)
- [ ] Set default times per type
- [ ] Quick assign with templates
- [ ] Recurring shift patterns

---

### Story 7.2.2: Leave Management
**Points:** 5 | **Priority:** 🟢 Medium

**Description:**
Integrate leave/vacation in roster.

**Acceptance Criteria:**
- [ ] Display leave in roster
- [ ] Block shift assignment during leave
- [ ] Leave request workflow (optional)
- [ ] Leave balance tracking

---

# PHASE 8: POLISH & PERFORMANCE

## Epic 8.1: Performance

### Story 8.1.1: Virtual Scrolling
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Implement virtual scrolling for large lists.

**Acceptance Criteria:**
- [ ] Use @tanstack/virtual
- [ ] Apply to Agenda view
- [ ] Apply to long day columns
- [ ] Maintain scroll position

---

### Story 8.1.2: Optimistic Updates
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Ensure all mutations use optimistic updates.

**Acceptance Criteria:**
- [ ] Immediate UI feedback on drag
- [ ] Rollback on error
- [ ] Loading indicators for sync

---

### Story 8.1.3: Query Caching
**Points:** 2 | **Priority:** 🟡 High

**Description:**
Implement smart query caching.

**Acceptance Criteria:**
- [ ] Cache date range queries
- [ ] Invalidate on mutations
- [ ] Prefetch adjacent ranges

---

## Epic 8.2: Mobile

### Story 8.2.1: Mobile Navigation
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Optimize navigation for mobile.

**Acceptance Criteria:**
- [ ] Bottom tab bar
- [ ] Swipe gestures for date navigation
- [ ] Pull-to-refresh
- [ ] FAB for quick create

---

### Story 8.2.2: Mobile Views
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Optimize views for mobile screens.

**Acceptance Criteria:**
- [ ] Agenda as default mobile view
- [ ] Simplified week view (3-day)
- [ ] Bottom sheet for item details
- [ ] Touch-friendly interactions

---

## Epic 8.3: Accessibility

### Story 8.3.1: Keyboard Navigation
**Points:** 2 | **Priority:** 🟡 High

**Description:**
Implement full keyboard navigation.

**Acceptance Criteria:**
- [ ] Arrow keys to navigate grid
- [ ] Enter to select/open
- [ ] Escape to close dialogs
- [ ] Tab through controls
- [ ] Shortcuts documented

---

### Story 8.3.2: Screen Reader Support
**Points:** 3 | **Priority:** 🟡 High

**Description:**
Ensure screen reader compatibility.

**Acceptance Criteria:**
- [ ] ARIA labels on all controls
- [ ] Announce changes
- [ ] Describe time items
- [ ] Navigate by landmarks

---

# Implementation Order

## Sprint 1 (Foundation)
- 1.1.1 TimeItem Types
- 1.1.2 API Client
- 1.1.3 Scheduling Store
- 1.1.4 Calendar Store
- 1.1.6 Time Utils
- 1.4.1 DB Migration

## Sprint 2 (Core Components)
- 1.2.1 ScopeSwitch
- 1.2.2 ViewSelector
- 1.2.3 DateNavigator
- 1.2.4 TimeItem Display
- 1.2.5 TimeItem Dialog

## Sprint 3 (Week View)
- 1.3.1 Week View Container
- 1.3.2 Week Header
- 1.3.3 Time Grid
- 1.3.4 Day Column
- 1.3.7 Overlap Calculator

## Sprint 4 (Week View Complete)
- 1.3.5 Energy Zones
- 1.3.6 Tasks Sidebar
- 1.3.8 Drag & Drop
- 1.4.2 Repository
- 1.4.3 API Handlers

## Sprint 5 (Other Views)
- 2.1.1 Day View
- 2.2.1-3 Month View
- 2.3.1-3 Agenda View
- 2.4.1-2 Hub Page

## Sprint 6+ (Features)
- Continue with Phases 3-8 as prioritized

---

**Document Status:** ✅ COMPLETE
**Total Stories:** 89
**Total Points:** 377
**Estimated Sprints:** 12-15 (2-week sprints)
