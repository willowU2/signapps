---
name: workflows-debug
description: Use when debugging the Workflows (automation engine) module. Spec at docs/product-specs/18-workflows.md. Visual workflow builder (trigger → condition → action), cron-based scheduling, cross-module event triggers (form submitted, deal moved, email received, calendar event created). May use a dedicated engine or PgEventBus-based.
---

# Workflows — Debug Skill

## Source of truth
**`docs/product-specs/18-workflows.md`**

## Code map
- **Frontend**: `client/src/app/workflows/`, components `client/src/components/workflows/`
- **Backend**: May use `PgEventBus` + a workflow execution engine
- **E2E**: 0 tests, 0 data-testids

## Key journeys
1. Create workflow: trigger (form submitted) → action (create task)
2. Visual builder: drag nodes, connect edges
3. Test workflow with mock trigger
4. View execution history / logs
5. Enable/disable workflow toggle

## Common bug patterns (anticipated)
1. **Infinite loop** — workflow triggers itself (guard needed)
2. **PgEventBus lag** — event processing delay
3. **Condition evaluation wrong** — string vs number comparison
4. **Cron schedule not firing** — timezone issue

## Historique
- **2026-04-09** : Skill créé (skeleton).
