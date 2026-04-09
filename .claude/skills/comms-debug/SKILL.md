---
name: comms-debug
description: Debug skill for the Communication module (/comms). Hub page with 6 sub-modules — annonces, actualites, suggestions, sondages, newsletter, affichage numerique — plus mention-notifications and teams-directory.
---

# Communication — Debug Skill

## Source of truth

**`docs/product-specs/57-comms.md`** — read spec first.

## Code map

### Backend (Rust)
- **No dedicated comms service** — sub-modules likely use existing services (identity for users/teams, notifications for alerts, storage for media)
- **Potential handlers**: spread across `signapps-identity` (teams directory), `signapps-notifications` (port 8095), `signapps-social` (port 3019)

### Frontend (Next.js)
- **Hub page**: `client/src/app/comms/page.tsx` (card grid linking to 6 sub-modules)
- **Sub-modules**:
  - `client/src/app/comms/announcements/page.tsx` — Annonces (company-wide announcements)
  - `client/src/app/comms/news-feed/page.tsx` — Actualites (news feed)
  - `client/src/app/comms/suggestions/page.tsx` — Suggestions (employee suggestions/ideas)
  - `client/src/app/comms/polls/page.tsx` — Sondages (polls and surveys)
  - `client/src/app/comms/newsletter/page.tsx` — Newsletter (email newsletter builder)
  - `client/src/app/comms/digital-signage/page.tsx` — Affichage numerique (digital signage screens)
  - `client/src/app/comms/mention-notifications/page.tsx` — Mention notifications
  - `client/src/app/comms/teams-directory/page.tsx` — Teams directory
- **Hub icons**: Megaphone (annonces), Newspaper (actualites), Lightbulb (suggestions), BarChart2 (sondages), Mail (newsletter), Monitor (affichage numerique)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `comms-root` | Comms hub page container |
| `comms-card-announcements` | Annonces card link |
| `comms-card-news-feed` | Actualites card link |
| `comms-card-suggestions` | Suggestions card link |
| `comms-card-polls` | Sondages card link |
| `comms-card-newsletter` | Newsletter card link |
| `comms-card-digital-signage` | Affichage numerique card link |
| `announcements-root` | Announcements sub-page container |
| `news-feed-root` | News feed sub-page container |
| `suggestions-root` | Suggestions sub-page container |
| `polls-root` | Polls sub-page container |
| `newsletter-root` | Newsletter sub-page container |
| `digital-signage-root` | Digital signage sub-page container |

## Key E2E journeys

1. **Hub navigation** — load `/comms`, verify 6 cards displayed, click each card navigates to correct sub-route
2. **Announcements CRUD** — create announcement, verify displayed in list, edit, delete
3. **Poll creation** — create poll with options, vote, verify results display
4. **Suggestions submit** — submit a suggestion, verify it appears in the list
5. **Newsletter send** — compose newsletter, preview, send to recipients
6. **Digital signage** — create signage content, assign to screen, verify display

## Common bug patterns

1. **Hub-only shell** — the hub page is purely navigation cards with no data fetching; if sub-module pages are stubs or incomplete, clicking a card may show an empty or broken page
2. **Missing backend endpoints** — comms sub-modules may lack dedicated backend CRUD endpoints, relying on mock data or localStorage
3. **Inconsistent routing** — hub links use `/comms/announcements` etc. but the actual sub-pages may not all be implemented (check for 404s)
4. **No shared state** — each sub-module is independent; no Zustand store for comms hub, so cross-module features (e.g., mention from announcement in notification) require inter-page coordination
5. **Extra sub-pages not in hub** — `mention-notifications/` and `teams-directory/` exist as routes but are not listed in the hub's `subPages` array

## Debug checklist

- [ ] Verify all 6 hub card links resolve to working pages (no 404)
- [ ] Check each sub-module for backend API connectivity
- [ ] Verify announcements, polls, suggestions have CRUD operations
- [ ] Test newsletter email sending (may require mail service port 3012)
- [ ] Check digital signage screen assignment and preview
- [ ] Verify mention-notifications and teams-directory pages are accessible even if not in hub

## Dependencies (license check)

- **Frontend**: react, next, lucide-react — MIT
- Verify: `cd client && npm run license-check:strict`
