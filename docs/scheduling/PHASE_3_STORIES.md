# Phase 3: Scheduling UI - Advanced Features

## Overview
Phase 3 builds upon the MVP (Phase 1) and core features (Phase 2) with advanced collaboration, notifications, and productivity features.

---

## Epic 3.1: Event Templates (8 points)

### Story 3.1.1: Event Template Data Model (2 points)
**As a** user
**I want** event templates to be stored and managed
**So that** I can quickly create similar events

**Acceptance Criteria:**
- [ ] EventTemplate type defined in scheduling.ts
- [ ] Template CRUD operations in calendar.ts API
- [ ] localStorage persistence for MVP

**Files:**
- `lib/scheduling/types/scheduling.ts`
- `lib/scheduling/api/calendar.ts`

---

### Story 3.1.2: Template Management UI (3 points)
**As a** user
**I want** to create, edit, and delete templates
**So that** I can manage my reusable event patterns

**Acceptance Criteria:**
- [ ] TemplateSheet component for create/edit
- [ ] Template list with search
- [ ] Delete confirmation

**Files:**
- `components/scheduling/templates/TemplateSheet.tsx`
- `components/scheduling/templates/TemplateList.tsx`

---

### Story 3.1.3: Quick Create from Template (3 points)
**As a** user
**I want** to create events from templates
**So that** I can save time on repetitive scheduling

**Acceptance Criteria:**
- [ ] Template selector in EventSheet
- [ ] Pre-fill form from template
- [ ] Template suggestions in QuickCreate

**Files:**
- `components/scheduling/calendar/EventSheet.tsx`
- `components/scheduling/command-palette/QuickCreate.tsx`

---

## Epic 3.2: Conflict Detection (13 points)

### Story 3.2.1: Conflict Detection Service (5 points)
**As a** user
**I want** the system to detect scheduling conflicts
**So that** I don't double-book myself

**Acceptance Criteria:**
- [ ] Conflict detection utility functions
- [ ] Check against existing events
- [ ] Support for buffer time between events
- [ ] Resource conflict detection

**Files:**
- `lib/scheduling/utils/conflict-detection.ts`

---

### Story 3.2.2: Conflict Warning UI (5 points)
**As a** user
**I want** to see warnings when creating conflicting events
**So that** I can make informed decisions

**Acceptance Criteria:**
- [ ] ConflictWarning component
- [ ] Show conflicting events
- [ ] Allow override with confirmation
- [ ] Suggest alternative times

**Files:**
- `components/scheduling/calendar/ConflictWarning.tsx`
- `components/scheduling/calendar/EventSheet.tsx` (integration)

---

### Story 3.2.3: Conflict Resolution Suggestions (3 points)
**As a** user
**I want** suggested alternatives when conflicts occur
**So that** I can quickly find available times

**Acceptance Criteria:**
- [ ] Find next available slot algorithm
- [ ] Show suggestions in ConflictWarning
- [ ] One-click apply suggestion

**Files:**
- `lib/scheduling/utils/conflict-detection.ts`
- `components/scheduling/calendar/ConflictWarning.tsx`

---

## Epic 3.3: Meeting Scheduler (21 points)

### Story 3.3.1: Availability Finder Service (5 points)
**As a** user
**I want** to find common available times for attendees
**So that** I can schedule meetings efficiently

**Acceptance Criteria:**
- [ ] findCommonSlots function
- [ ] Support multiple attendees
- [ ] Respect working hours
- [ ] Duration-aware slot finding

**Files:**
- `lib/scheduling/utils/availability-finder.ts`

---

### Story 3.3.2: Find Time Dialog (8 points)
**As a** user
**I want** a dialog to find available meeting times
**So that** I can visually compare attendee availability

**Acceptance Criteria:**
- [ ] FindTimeDialog component
- [ ] Attendee selection
- [ ] Duration selection
- [ ] Visual availability grid
- [ ] Suggested times list

**Files:**
- `components/scheduling/meeting/FindTimeDialog.tsx`
- `components/scheduling/meeting/AvailabilityGrid.tsx`

---

### Story 3.3.3: Attendee Availability Display (5 points)
**As a** user
**I want** to see attendee availability in the event form
**So that** I know if attendees are free

**Acceptance Criteria:**
- [ ] Availability indicator per attendee
- [ ] Busy/free status display
- [ ] Conflict count badge

**Files:**
- `components/scheduling/calendar/EventSheet.tsx`
- `components/scheduling/meeting/AttendeeAvailability.tsx`

---

### Story 3.3.4: Meeting Poll (3 points)
**As a** user
**I want** to poll attendees for preferred times
**So that** I can schedule at the best time for everyone

**Acceptance Criteria:**
- [ ] MeetingPoll type
- [ ] Poll creation UI
- [ ] Vote collection (MVP: localStorage)

**Files:**
- `lib/scheduling/types/scheduling.ts`
- `components/scheduling/meeting/MeetingPoll.tsx`

---

## Epic 3.4: RSVP & Attendee Management (13 points)

### Story 3.4.1: RSVP Status Tracking (3 points)
**As a** user
**I want** to track attendee responses
**So that** I know who's attending

**Acceptance Criteria:**
- [ ] RSVP status in attendee type (accepted/declined/tentative/pending)
- [ ] Update RSVP mutation
- [ ] RSVP summary display

**Files:**
- `lib/scheduling/types/scheduling.ts`
- `lib/scheduling/api/calendar.ts`

---

### Story 3.4.2: RSVP Actions UI (5 points)
**As an** attendee
**I want** to respond to meeting invitations
**So that** organizers know my availability

**Acceptance Criteria:**
- [ ] RSVPButtons component
- [ ] Accept/Decline/Tentative options
- [ ] Optional decline reason
- [ ] Confirmation feedback

**Files:**
- `components/scheduling/calendar/RSVPButtons.tsx`
- `components/scheduling/calendar/EventSheet.tsx`

---

### Story 3.4.3: Attendee List Management (5 points)
**As an** organizer
**I want** to manage attendees with required/optional status
**So that** I can prioritize attendance

**Acceptance Criteria:**
- [ ] Required vs optional attendee toggle
- [ ] Attendee search/add from team
- [ ] Remove attendee
- [ ] RSVP status per attendee

**Files:**
- `components/scheduling/calendar/AttendeeList.tsx`
- `components/scheduling/calendar/EventSheet.tsx`

---

## Epic 3.5: Location Features (8 points)

### Story 3.5.1: Location Field Implementation (3 points)
**As a** user
**I want** to add locations to events
**So that** attendees know where to go

**Acceptance Criteria:**
- [ ] Location field in ScheduleBlock type
- [ ] Location input in EventSheet
- [ ] Display location in EventBlock

**Files:**
- `lib/scheduling/types/scheduling.ts`
- `components/scheduling/calendar/EventSheet.tsx`
- `components/scheduling/calendar/EventBlock.tsx`

---

### Story 3.5.2: Location Suggestions (5 points)
**As a** user
**I want** location suggestions based on resources
**So that** I can quickly select meeting rooms

**Acceptance Criteria:**
- [ ] Suggest resources as locations
- [ ] Recent locations history
- [ ] Manual location entry

**Files:**
- `components/scheduling/calendar/LocationSelect.tsx`
- `components/scheduling/calendar/EventSheet.tsx`

---

## Epic 3.6: Search & Filtering (13 points)

### Story 3.6.1: Global Search (5 points)
**As a** user
**I want** to search across all scheduling items
**So that** I can quickly find events, tasks, or resources

**Acceptance Criteria:**
- [ ] Search across events, tasks, resources
- [ ] Full-text search
- [ ] Result categorization

**Files:**
- `lib/scheduling/utils/search.ts`
- `components/scheduling/search/GlobalSearch.tsx`

---

### Story 3.6.2: Advanced Filters (5 points)
**As a** user
**I want** advanced filtering options
**So that** I can narrow down results

**Acceptance Criteria:**
- [ ] Filter by date range
- [ ] Filter by status
- [ ] Filter by calendar/category
- [ ] Filter by attendees

**Files:**
- `components/scheduling/search/AdvancedFilters.tsx`

---

### Story 3.6.3: Saved Filters (3 points)
**As a** user
**I want** to save filter combinations
**So that** I can reuse them quickly

**Acceptance Criteria:**
- [ ] Save current filter as preset
- [ ] List saved filters
- [ ] Apply saved filter

**Files:**
- `components/scheduling/search/SavedFilters.tsx`
- `stores/scheduling-store.ts`

---

## Epic 3.7: Calendar Export/Import (8 points)

### Story 3.7.1: iCal Export (3 points)
**As a** user
**I want** to export events as iCal
**So that** I can share with external calendars

**Acceptance Criteria:**
- [ ] Generate .ics file
- [ ] Single event export
- [ ] Date range export

**Files:**
- `lib/scheduling/utils/ical-export.ts`

---

### Story 3.7.2: iCal Import (5 points)
**As a** user
**I want** to import events from iCal files
**So that** I can bring in external events

**Acceptance Criteria:**
- [ ] Parse .ics files
- [ ] Preview import
- [ ] Conflict handling
- [ ] Batch import

**Files:**
- `lib/scheduling/utils/ical-import.ts`
- `components/scheduling/import/ImportDialog.tsx`

---

## Summary

| Epic | Stories | Points |
|------|---------|--------|
| 3.1 Event Templates | 3 | 8 |
| 3.2 Conflict Detection | 3 | 13 |
| 3.3 Meeting Scheduler | 4 | 21 |
| 3.4 RSVP & Attendees | 3 | 13 |
| 3.5 Location Features | 2 | 8 |
| 3.6 Search & Filtering | 3 | 13 |
| 3.7 Calendar Export/Import | 2 | 8 |
| **Total** | **20** | **84** |

---

## Implementation Order

1. 3.1.1 → 3.1.2 → 3.1.3 (Templates foundation)
2. 3.2.1 → 3.2.2 → 3.2.3 (Conflict detection)
3. 3.5.1 → 3.5.2 (Location - unblocks other features)
4. 3.4.1 → 3.4.2 → 3.4.3 (RSVP)
5. 3.3.1 → 3.3.2 → 3.3.3 → 3.3.4 (Meeting scheduler)
6. 3.6.1 → 3.6.2 → 3.6.3 (Search)
7. 3.7.1 → 3.7.2 (Export/Import)
