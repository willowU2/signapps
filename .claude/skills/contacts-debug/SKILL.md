---
name: contacts-debug
description: Use when debugging the Contacts module. Spec at docs/product-specs/14-contacts.md. Frontend exists (2 pages, 13 components), backend via signapps-contacts service. Features include contact cards, import CSV/vCard, merge duplicates, enrichment, tags, groups, activity timeline. 0 data-testids, 0 E2E tests.
---

# Contacts — Debug Skill

## Source of truth
**`docs/product-specs/14-contacts.md`**

## Code map
- **Backend**: `services/signapps-contacts/` — handles contacts + CRM deals
- **Frontend**: `client/src/app/contacts/` (2 pages), `client/src/components/contacts/` (13 components: cards, lists, import, dedup, enrichment)
- **E2E**: 0 tests, 0 data-testids, no Page Object

## Key data-testids to add
`contacts-root`, `contacts-list`, `contacts-list-item-{id}`, `contacts-new-button`, `contacts-create-dialog`, `contacts-create-name`, `contacts-create-email`, `contacts-create-phone`, `contacts-create-company`, `contacts-create-submit`, `contacts-search-input`, `contacts-import-button`, `contacts-import-upload`, `contacts-dedup-button`, `contacts-detail-root`, `contacts-detail-edit`, `contacts-detail-delete`, `contacts-tags-{contactId}`, `contacts-group-{groupId}`

## Key journeys to test
1. Create contact → verify in list
2. Import CSV → column mapping → verify contacts created
3. Search by name/email → verify filtered results
4. Merge duplicate contacts → verify single record
5. Open contact detail → edit → save → verify updated

## Common bug patterns (anticipated)
1. **Import CSV encoding** — UTF-8 BOM needed for French chars
2. **Dedup false positives** — fuzzy matching too aggressive on short names
3. **Contact enrichment hangs** — external API timeout not handled
4. **Tags not persisting** — JSONB array append race condition
5. **Activity timeline empty** — cross-module events (mail, calendar) not linked
6. **vCard import ignores photo** — base64 image not parsed

## Dependencies
- **papaparse** (MIT) for CSV ✅
- **vcf** or custom vCard parser — check license

## Cross-module interactions
- **CRM** — contacts are linked to deals
- **Mail** — recipient autocomplete from contacts
- **Calendar** — attendee picker from contacts
- **Chat** — contact card in DM
- **Forms** — form responses can create contacts

## Historique
- **2026-04-09** : Skill créé. 2 pages + 13 composants, 0 E2E, 0 testids.
