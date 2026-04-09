---
name: helpdesk-debug
description: Use when debugging the Helpdesk (ticket management) module. Spec at docs/product-specs/16-helpdesk.md. Covers ticket creation, assignment, SLA tracking, knowledge base, customer portal, canned responses, escalation. Backend may share with signapps-chat or dedicated service.
---

# Helpdesk — Debug Skill

## Source of truth
**`docs/product-specs/16-helpdesk.md`**

## Code map
- **Frontend**: `client/src/app/helpdesk/`, components `client/src/components/helpdesk/`
- **E2E**: 0 tests, 0 data-testids

## Key journeys
1. Create ticket → appears in queue
2. Assign ticket → assignee sees it
3. Reply to ticket → customer gets notification
4. Escalate ticket → SLA clock running
5. Close ticket → satisfaction survey

## Historique
- **2026-04-09** : Skill créé (skeleton).
