---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments: ['brainstorming-session-2026-03-18-calendar-from-scratch.md']
workflowType: 'prd'
status: 'complete'
---

# Product Requirements Document - Unified Scheduling System

**Author:** Etienne
**Date:** 2026-03-18
**Version:** 1.0
**Status:** Approved for Development

---

## 1. Executive Summary

### 1.1 Vision Statement

Build a **Unified Scheduling System** that consolidates personal productivity, team coordination, project planning, HR scheduling, and external booking into ONE seamless experience with AI-powered energy-aware scheduling.

### 1.2 Problem Statement

Current solutions (Google Workspace, Outlook, Notion) suffer from:
- **Fragmentation**: Tasks, calendar, and scheduling are separate applications
- **No project scheduling**: Cannot plan projects with resource allocation
- **No HR/team scheduling**: Cannot manage shifts, leave, availability
- **Binary sharing**: Only "my calendar" vs "shared calendar" - no nuanced scopes
- **No energy awareness**: Tasks scheduled without considering productivity patterns

### 1.3 Solution Overview

A unified system built on:
- **ONE Object Model**: TimeItem (task/event/booking/shift/milestone)
- **THREE Scopes**: MOI (personal) / EUX (team visibility) / NOUS (collaborative)
- **ENERGY-AWARE AI**: Auto-scheduling based on productivity patterns
- **ENTERPRISE-READY**: Multi-société hierarchy with federated sharing

### 1.4 Success Metrics

| Metric | Target |
|--------|--------|
| User adoption rate | >80% daily active users |
| Time to schedule task | <5 seconds (drag-drop) |
| AI scheduling accuracy | >85% user acceptance |
| Cross-team visibility | 100% of shared items visible |
| External booking completion | >90% success rate |

---

## 2. User Personas

### 2.1 Primary Personas

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **Individual Contributor** | Team member managing personal work | Personal tasks, deadlines, focus time |
| **Manager** | Team lead overseeing resources | Team overview, project timelines, allocation |
| **HR Administrator** | Manages workforce scheduling | Shifts, leave, availability, rosters |
| **Project Manager** | Plans and tracks projects | Milestones, dependencies, Gantt views |
| **External Client** | Books appointments | Simple booking page with availability |

### 2.2 User Stories by Persona

#### Individual Contributor
- As a contributor, I want to see MY tasks and events unified so I know what I must do
- As a contributor, I want to drag tasks to time slots to schedule my deep work
- As a contributor, I want AI to suggest optimal times for high-focus work
- As a contributor, I want Pomodoro-style iterations for long tasks

#### Manager
- As a manager, I want to see what MY TEAM is doing (EUX scope)
- As a manager, I want to identify scheduling conflicts across team members
- As a manager, I want to see team availability as a heatmap
- As a manager, I want to assign tasks and see their status

#### HR Administrator
- As HR admin, I want to create and manage shift schedules
- As HR admin, I want to track leave requests and availability
- As HR admin, I want roster views by service/department
- As HR admin, I want to prevent scheduling conflicts

#### Project Manager
- As a PM, I want to see project timelines with milestones
- As a PM, I want dependencies between tasks (Gantt-style)
- As a PM, I want the timeline to auto-adjust when things slip
- As a PM, I want sprint/cycle planning views

#### External Client
- As an external user, I want to book an appointment with available slots
- As an external user, I want clear confirmation and reminders
- As an external user, I want to reschedule easily if needed

---

## 3. Functional Requirements

### 3.1 Core Data Model: TimeItem

```typescript
interface TimeItem {
  // Identity
  id: UUID
  type: 'task' | 'event' | 'booking' | 'shift' | 'milestone' | 'reminder' | 'blocker'

  // Content
  title: string
  description?: string
  tags: string[]
  color?: string

  // Time
  start_time?: DateTime
  end_time?: DateTime
  deadline?: DateTime
  duration?: Duration
  all_day?: boolean

  // Location
  location?: string | LocationObject

  // Organization Hierarchy
  societe_id: UUID           // Tenant (company)
  business_unit_id?: UUID
  service_id?: UUID
  project_id?: UUID

  // Ownership & Sharing
  owner_id: UUID
  users: UUID[]              // Individual participants
  groups: UUID[]             // Group participants
  scope: 'moi' | 'eux' | 'nous'
  visibility: 'private' | 'group' | 'service' | 'bu' | 'company' | 'public'

  // Status & Priority
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'

  // Energy & Focus (Productivity)
  focus_level: 'deep' | 'medium' | 'shallow' | 'break'
  energy_required: 'high' | 'medium' | 'low'
  value_score?: number       // Business value 1-10
  estimated_pomodoros?: number
  actual_pomodoros?: number
  preferred_time_of_day?: 'morning' | 'midday' | 'afternoon' | 'evening'
  min_block_duration?: number
  max_block_duration?: number

  // Relations
  dependencies: UUID[]       // Blocked by these items
  parent_id?: UUID           // For subtasks/sub-events
  recurrence?: RecurrenceRule
  template_id?: UUID         // Created from template

  // Booking-specific
  resource_id?: UUID         // Room, equipment, etc.
  booking_link?: string      // External booking URL
  booking_rules?: BookingRules

  // Metadata
  created_at: DateTime
  updated_at: DateTime
  created_by: UUID
}

interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  interval: number
  days_of_week?: number[]
  end_date?: DateTime
  count?: number
  exceptions: DateTime[]
}

interface BookingRules {
  min_notice: Duration
  max_advance: Duration
  buffer_before?: Duration
  buffer_after?: Duration
  max_per_day?: number
  allowed_times?: TimeRange[]
  blocked_times?: TimeRange[]
}
```

### 3.2 Organizational Hierarchy

```
🏢 Société (Tenant/Company)
 ├── 🏛️ Business Unit
 │    ├── 🏬 Service (Department)
 │    │    ├── 👥 Groupe
 │    │    │    └── 👤 User
 │    │    └── 👥 Groupe
 │    └── 🏬 Service
 └── 🏛️ Business Unit
```

**Visibility Inheritance:**
- Items inherit visibility from their project by default
- Can be overridden to be more restrictive (not more permissive)
- Cross-société sharing enabled for federated collaboration

### 3.3 Scope System (MOI / EUX / NOUS)

| Scope | Filter | Shows |
|-------|--------|-------|
| **MOI** | `owner_id = current_user` | My items only |
| **EUX** | `users.includes(team_members) OR groups.includes(my_groups)` | Team items I can see |
| **NOUS** | `scope = 'nous' AND (users.includes(me) OR groups.includes(my_groups))` | Collaborative items |
| **ALL** | Combined view | Everything I have access to |

### 3.4 View Requirements

| View | Primary Use | Key Features |
|------|-------------|--------------|
| **Week View** | Main planning interface | Energy zones, drag-drop, tasks sidebar |
| **Day View** | Detailed daily schedule | Hourly breakdown, focus mode toggle |
| **Month View** | Big picture overview | Deadline indicators, density heatmap |
| **Agenda View** | List of upcoming items | Mobile-optimized, quick actions |
| **Timeline View** | Project planning | Gantt-style, dependencies, milestones |
| **Kanban View** | Task workflow | Status columns, WIP limits |
| **Heatmap View** | Team availability | Click to book, conflict detection |
| **Focus View** | Deep work mode | Single task, Pomodoro timer, no distractions |
| **Roster View** | HR shift management | By person/day matrix, shift templates |

### 3.5 Feature Requirements

#### F1: Smart Input (Natural Language)
- Parse "Réunion équipe vendredi 14h haute priorité"
- Extract: type, date/time, priority, participants
- Confirm and create in one action

#### F2: Day Planner Wizard
- Morning planning ritual
- AI suggests optimal day based on tasks and patterns
- One-click accept or manual adjust

#### F3: AI Auto-Scheduling
- Analyze deadlines and priorities
- Consider energy levels by time of day
- Propose schedule with reasoning
- Learn from user adjustments

#### F4: Energy-Aware Scheduling
- Tag tasks by focus level required
- Morning = high focus tasks
- Afternoon = low focus tasks
- Respect user preferences

#### F5: Pomodoro Integration
- Estimate tasks in pomodoros
- Timer during execution
- Track actual vs estimated
- Suggest breaks

#### F6: Conflict Resolution
- Detect overlapping items
- Suggest alternatives: "Move to 14h? Jean is free then"
- Auto-resolve with rules

#### F7: Template Workflows
- Create recurring workflow templates
- "Weekly Sprint" = auto-creates standup, review, retro
- Clone and customize

#### F8: External Booking
- Public booking pages
- Smart availability rules
- Buffer times
- Max per day limits
- Integration with external calendars

#### F9: Drag-Drop Sharing
- Drag item to user = share with user
- Drag item to group = share with group
- Visual feedback on permissions

#### F10: Dependencies
- "Can't start until X is done"
- Visual dependency lines in timeline
- Auto-adjust downstream when parent slips

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Page load: <1s
- Drag-drop response: <100ms
- API response: <200ms
- Support 10,000+ TimeItems per user

### 4.2 Scalability
- Multi-tenant architecture
- Horizontal scaling
- 100+ concurrent users per tenant

### 4.3 Security
- JWT authentication (existing)
- Role-based access control
- Visibility enforcement at API level
- Audit logging for sensitive operations

### 4.4 Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- High contrast mode

### 4.5 Responsiveness
- Desktop (1200px+): Full feature set
- Tablet (768-1199px): Adapted layouts
- Mobile (320-767px): Touch-optimized, essential features

---

## 5. Integration Requirements

### 5.1 Existing Backend Services
- `signapps-identity` (port 3001): User auth, groups, hierarchy
- `signapps-storage` (port 3004): Attachments
- `signapps-scheduler` (port 3007): Cron jobs, reminders
- `signapps-ai` (port 3005): AI scheduling suggestions

### 5.2 External Integrations (Future)
- Google Calendar sync
- Outlook/Exchange sync
- iCal import/export
- Slack/Teams notifications

---

## 6. Out of Scope (V1)

- Video conferencing integration
- Time tracking/billing
- Invoice generation
- Complex resource capacity planning
- Multi-language UI (English only for V1)

---

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep | High | Strict phase boundaries, MVP first |
| AI accuracy | Medium | Fallback to manual, learn from feedback |
| Performance with large datasets | Medium | Pagination, virtualization, indexing |
| User adoption | Medium | Gradual rollout, training materials |

---

## 8. Release Strategy

### Phase 1: Foundation (Week View MVP)
- TimeItem model
- Week View with energy zones
- Scope toggle (MOI/EUX/NOUS)
- Basic CRUD operations
- Drag-drop scheduling

### Phase 2: Complete Calendar
- Day, Month, Agenda views
- Recurrence support
- Reminders

### Phase 3: Productivity
- Smart Input
- Day Planner
- Pomodoro timer

### Phase 4: Team Features
- Heatmap view
- Booking pages
- Sharing UX

### Phase 5: Project Management
- Timeline/Gantt view
- Dependencies
- Kanban view

### Phase 6: AI Features
- Auto-scheduling
- Pattern learning
- Conflict resolution

### Phase 7: HR Features
- Roster view
- Shift management
- Leave tracking

---

## 9. Appendices

### A. Wireframe Reference
See brainstorming document for Week View wireframe.

### B. Glossary
- **TimeItem**: Unified object representing any scheduled item
- **Scope**: Visibility filter (MOI/EUX/NOUS)
- **Energy Zone**: Time period categorized by productivity level
- **Pomodoro**: 25-minute focused work iteration

---

**Document Status:** ✅ APPROVED FOR DEVELOPMENT
**Next Step:** Architecture Document
