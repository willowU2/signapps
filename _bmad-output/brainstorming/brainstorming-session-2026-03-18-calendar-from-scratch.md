---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Complete Frontend Rebuild: Calendar + Tasks + Events + Bookings with Sharing'
session_goals: 'Full UI/UX redesign, new architecture, multi-view, multi-device, user/group sharing'
selected_approach: 'AI-Recommended + Progressive Flow'
techniques_used: ['First Principles', 'Role Playing', 'What-If Scenarios', 'SCAMPER', 'Morphological Analysis', 'Cross-Pollination', 'Concept Blending']
ideas_generated: ['Unified TimeItem model', 'MOI/EUX/NOUS scopes', 'Energy-aware scheduling', 'AI auto-scheduling', 'Cross-société sharing', 'TimeBoard', 'AvailabilityPicker', 'DeepFlow', 'DayGenius', 'SmartInput', 'LiveTimeline', 'ScopeSwitch', 'Pomodoro integration', 'Natural language input', 'Week View with energy zones', 'Tasks sidebar drag-drop']
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Etienne
**Date:** 2026-03-18 22:45

---

## Session Overview

**Topic:** Complete Frontend Rebuild - Calendar + Tasks + Events + Bookings with User/Group Sharing

**Goals:**
- Full UI/UX redesign from scratch
- New technical architecture
- Multi-view system (day/week/month/agenda)
- Multi-device responsive (desktop, tablet, mobile)
- Integration with existing backend APIs (improved)
- Sharing with users and groups
- Consistent UX, fill missing features

**Approach:** AI-Recommended techniques organized in Progressive Flow (divergent → convergent)

---

## Phase 1: DIVERGENT EXPLORATION

### First Principles Insights

**The Problem with Existing Tools (Google Workspace, etc.):**
- Tasks separate from calendar
- No project scheduling
- No HR/team scheduling
- Binary sharing (my calendar vs shared) - no nuance

**Fundamental User Need:**
> "What needs to happen, by when, and who's responsible?"

**THREE SCOPES OF WORK:**
| Scope | Question |
|-------|----------|
| **MOI (I)** | What must I do? |
| **EUX (They)** | What are they doing? |
| **NOUS (We)** | What must we do together? |

### User Personas (ALL Primary)

1. 👤 **Individual** — Personal tasks, planning, deadlines, habits
2. 👨‍💼 **Manager** — Team overview, project timelines, resource allocation
3. 👩‍💻 **Team Member** — My work + team awareness + shared goals
4. 👨‍🔧 **HR/Admin** — Shifts, leave, availability, resource booking
5. 🤝 **External** — Book appointments with team/resources

### What-If Radical Ideas (ALL APPROVED ✅)

| # | Radical Concept | Status |
|---|-----------------|--------|
| 1 | No separate calendar/tasks — everything is "TimeItem" | ✅ |
| 2 | MOI/EUX/NOUS scope toggle (not separate apps) | ✅ |
| 3 | AI auto-schedules tasks based on deadlines | ✅ |
| 4 | Bookings, events, tasks, shifts = same unified object | ✅ |
| 5 | Sharing via drag-drop to user/group | ✅ |
| 6 | Calendar learns user patterns (predictive) | ✅ |
| 7 | Conflicts auto-resolve with suggestions | ✅ |
| 8 | Template recurring workflows ("Weekly sprint") | ✅ |
| 9 | Time blocks with dependencies (like tasks) | ✅ |
| 10 | Focus mode — hide everything except NOW | ✅ |
| 11 | Group availability as heatmap | ✅ |
| 12 | External booking with smart rules | ✅ |

---

## Phase 2: STRUCTURED FRAMEWORK

### Architecture Decisions

| Decision | Choice |
|----------|--------|
| Visibility | Inherit from project (cascading) |
| Cross-société | YES (federated sharing) |
| Booking targets | Both resources + people |
| Shifts | Separate type (HR-specific) |

### Organizational Hierarchy

```
🏢 Société (Tenant)
 └── 🏛️ Business Unit
      └── 🏬 Service
           └── 👥 Groupe
                └── 👤 User
```

### Unified TimeItem Model

```typescript
TimeItem {
  // Identity
  id, type, title, description, tags, color

  // Time
  start_time, end_time, deadline, duration, all_day

  // Location
  location: string | LocationObject

  // Organization Hierarchy
  societe_id, business_unit_id, service_id, project_id

  // Ownership & Sharing
  owner_id, users[], groups[]
  scope: 'moi' | 'eux' | 'nous'
  visibility: 'private' | 'group' | 'service' | 'bu' | 'company' | 'public'

  // Status & Priority
  status, priority: 'low' | 'medium' | 'high' | 'urgent'

  // Energy & Focus (Productivity Science)
  focus_level: 'deep' | 'medium' | 'shallow' | 'break'
  energy_required: 'high' | 'medium' | 'low'
  value_score: number (1-10)
  estimated_pomodoros, actual_pomodoros
  preferred_time_of_day: 'morning' | 'midday' | 'afternoon' | 'evening'
  min_block_duration, max_block_duration

  // Relations
  dependencies[], parent_id, recurrence

  // Metadata
  created_at, updated_at, created_by
}
```

### View System

| View | Purpose |
|------|---------|
| Day | Detailed schedule, time-blocking |
| Week | Planning, overview (MAIN VIEW) |
| Month | Big picture, deadlines |
| Agenda | Quick list scan, mobile |
| Timeline/Gantt | Projects, milestones |
| Kanban | Task workflow |
| Heatmap | Team availability |
| Focus | Deep work, NOW mode |
| Roster | HR shift scheduling |

### Energy-Aware Scheduling

- 🌅 Morning → High focus + High value tasks
- ☀️ Midday → Meetings, collaboration
- 🌆 Afternoon → Low-focus, administrative
- ⏱️ Pomodoro iterations (X min work / Y min break)

### Features to Integrate (ALL V1 🔴)

| Source | Feature |
|--------|---------|
| Notion | Multi-view on same data |
| Sunsama | "Plan my day" wizard |
| Reclaim.ai | AI auto-scheduling |
| Cal.com | Booking pages + rules |
| Clockify | Pomodoro time tracking |
| Linear | Cycles/sprints |
| Fantastical | Natural language input |

---

## Phase 3: CREATIVE INNOVATION

### Concept Blends (Killer Features)

| Feature Name | Blend | Description |
|--------------|-------|-------------|
| **TimeBoard** | Calendar + Kanban | Drag tasks across time AND status |
| **AvailabilityPicker** | Heatmap + Booking | See team availability, click to book |
| **DeepFlow** | Focus Mode + Pomodoro | One task, timer, no distractions |
| **DayGenius** | AI + Morning Planning | "Here's your optimal day" |
| **SmartInput** | Natural Language + All | "Réunion équipe vendredi 14h haute priorité" |
| **LiveTimeline** | Dependencies + Timeline | Gantt that auto-adjusts when things slip |
| **ScopeSwitch** | Scope Toggle + Everything | MOI/EUX/NOUS filter on ANY view |

### Unique Value Proposition

> "The ONLY system where personal productivity, team coordination, project planning, HR scheduling, AND external booking live in ONE unified experience with AI-powered energy-aware scheduling."

**Pillars:**
- 🎯 ONE OBJECT (TimeItem)
- 🔭 THREE SCOPES (MOI/EUX/NOUS)
- 🧠 ENERGY-AWARE AI
- 🏢 ENTERPRISE-READY (multi-société)

---

## Phase 4: CONVERGENT SYNTHESIS

### Component Architecture

```
src/components/scheduling/
├── core/
│   ├── TimeItem.tsx              # Unified item component
│   ├── ScopeSwitch.tsx           # MOI/EUX/NOUS toggle
│   ├── ViewSelector.tsx          # Day/Week/Month/etc
│   └── SmartInput.tsx            # Natural language creation
├── views/
│   ├── DayView.tsx
│   ├── WeekView.tsx              # 🎯 FIRST TO BUILD
│   ├── MonthView.tsx
│   ├── AgendaView.tsx
│   ├── TimelineView.tsx          # Gantt-style
│   ├── KanbanView.tsx
│   ├── HeatmapView.tsx           # Team availability
│   ├── FocusView.tsx             # Deep work mode
│   └── RosterView.tsx            # HR shifts
├── features/
│   ├── DayPlanner.tsx            # "Plan my day" wizard
│   ├── PomodoroTimer.tsx
│   ├── BookingPage.tsx           # External scheduling
│   ├── ConflictResolver.tsx
│   └── TemplateManager.tsx       # Recurring workflows
├── ai/
│   ├── AutoScheduler.tsx
│   ├── EnergyOptimizer.tsx
│   └── PatternLearner.tsx
└── sharing/
    ├── ShareModal.tsx
    ├── PermissionManager.tsx
    └── ExternalLinkGenerator.tsx
```

### Implementation Priority

| Phase | Components | Focus |
|-------|------------|-------|
| **1** | WeekView + TimeItem + ScopeSwitch | Core experience |
| **2** | DayView + MonthView + AgendaView | Complete calendar |
| **3** | SmartInput + DayPlanner | Productivity features |
| **4** | HeatmapView + BookingPage | Team & external |
| **5** | TimelineView + KanbanView | Project management |
| **6** | AI features | Intelligence layer |
| **7** | RosterView + FocusView | Specialized modes |

---

## 🎯 WEEK VIEW — Detailed Specification

### Core Features (Phase 1)

```
┌─────────────────────────────────────────────────────────────────┐
│  [< Prev]  March 17-23, 2026  [Next >]   [MOI|EUX|NOUS]  [⚙️]  │
├─────────────────────────────────────────────────────────────────┤
│        │ Lun 17 │ Mar 18 │ Mer 19 │ Jeu 20 │ Ven 21 │ Sam │ Dim│
│────────┼────────┼────────┼────────┼────────┼────────┼─────┼────│
│ 🌅 8h  │████████│        │████████│        │████████│     │    │
│ Peak   │Deep    │        │Meeting │        │Focus   │     │    │
│────────┼────────┼────────┼────────┼────────┼────────┼─────┼────│
│ ☀️ 12h │        │████████│        │████████│        │     │    │
│ Medium │        │Collab  │        │Review  │        │     │    │
│────────┼────────┼────────┼────────┼────────┼────────┼─────┼────│
│ 🌆 16h │░░░░░░░░│░░░░░░░░│░░░░░░░░│░░░░░░░░│░░░░░░░░│     │    │
│ Low    │Admin   │Emails  │Admin   │Emails  │Admin   │     │    │
├─────────────────────────────────────────────────────────────────┤
│ 📋 TASKS SIDEBAR                                                │
│ ┌─────────────────┐                                             │
│ │ 🔴 High Focus   │  ← Drag onto morning slots                  │
│ │ 🟡 Medium       │  ← Drag onto midday slots                   │
│ │ 🟢 Low          │  ← Drag onto afternoon slots                │
│ └─────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Week View Features

| Feature | Description |
|---------|-------------|
| **Energy zones** | Visual distinction morning/midday/afternoon |
| **Scope toggle** | MOI/EUX/NOUS filter |
| **Tasks sidebar** | Unscheduled tasks, drag to schedule |
| **Drag & drop** | Move/resize TimeItems |
| **Quick create** | Click empty slot → create |
| **Smart input** | Natural language "Réunion demain 14h" |
| **Color coding** | By type, priority, or project |
| **Overlap handling** | Stack or side-by-side |
| **Mini-month** | Navigation in corner |
| **Today indicator** | Visual current time line |

---

## ✅ BRAINSTORMING COMPLETE

### Summary of Decisions

| Aspect | Decision |
|--------|----------|
| **Model** | Unified TimeItem (task/event/booking/shift/milestone) |
| **Scopes** | MOI/EUX/NOUS with toggle |
| **Hierarchy** | Société → BU → Service → Groupe → User |
| **Visibility** | Inherit from project |
| **Cross-tenant** | YES (federated sharing) |
| **Energy-aware** | Morning peak, Pomodoro iterations |
| **AI features** | Auto-schedule, learn patterns, resolve conflicts |
| **First view** | WEEK VIEW |

### Next Steps

1. **Create PRD** — `/bmad CP` to formalize requirements
2. **Create Architecture** — `/bmad CA` for technical design
3. **Create Stories** — `/bmad CE` for implementation epics
4. **Start coding** — Week View first!

---

**Session completed: 2026-03-18 23:00**
**Ideas generated: 50+**
**Techniques used: First Principles, Role Playing, What-If, SCAMPER, Morphological Analysis, Cross-Pollination, Concept Blending**
