---
name: hr-workforce-debug
description: Use when debugging the HR & Workforce module. Spec at docs/product-specs/15-hr-workforce.md. Covers employee directory, org chart, leave management, timesheets, payroll prep, onboarding, performance reviews. Backend via signapps-workforce service. Interacts heavily with Calendar (leaves, shifts) and Identity (org structure).
---

# HR & Workforce — Debug Skill

## Source of truth
**`docs/product-specs/15-hr-workforce.md`**

## Code map
- **Backend**: `services/signapps-workforce/` (if exists, else via signapps-calendar for leaves/shifts)
- **Frontend**: `client/src/app/hr/` or `client/src/app/workforce/`, components in `client/src/components/hr/` or `workforce/`
- **E2E**: 0 tests, 0 data-testids

## Key journeys
1. Employee directory browse + search
2. Submit leave request → manager approval
3. Clock in/out timesheet
4. Org chart view + drill down
5. Onboarding checklist for new hire

## Dependencies
- **date-fns** (MIT), **@dnd-kit** (MIT) for org chart drag
- Calendar module for leaves/shifts integration

## Historique
- **2026-04-09** : Skill créé (skeleton).
