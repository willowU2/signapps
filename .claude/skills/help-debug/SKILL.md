---
name: help-debug
description: Debug skill for the Centre d'aide (/help). FAQ by category with collapsible items, keyboard shortcuts reference, service health check (pings all backend ports), support ticket contact form, "Quoi de neuf" section, and documentation links.
---

# Centre d'aide — Debug Skill

## Source of truth

**`docs/product-specs/52-help.md`** — read spec first.

## Code map

### Backend (Rust)

- **No dedicated backend** — the help page is purely frontend
- **Health checks**: pings `http://localhost:{port}/api/v1/health` for each service (no-cors mode)
- **Services checked**: Identity (3001), Containers (3002), Proxy (3003), Storage (3004), AI (3005), SecureLink (3006), Scheduler (3007), Metrics (3008), Media (3009)

### Frontend (Next.js)

- **Page**: `client/src/app/help/page.tsx` — single self-contained page (no extracted components)
- **Sections** (in render order):
  1. **Header** — icon + title "Centre d'aide"
  2. **Quoi de neuf** — hardcoded feature highlights (AI Gateway, Mail, Excel import, PWA, 50+ pages)
  3. **Search** — filters FAQ items by question, answer, or category text
  4. **Quick Links** — anchor links to #faq, #shortcuts, #system, #contact
  5. **FAQ** (`#faq`) — `FAQ_ITEMS[]` grouped by category (Compte, Documents, Mail, Calendrier, Stockage, IA, Securite, Administration), collapsible via Collapsible component
  6. **Keyboard Shortcuts** (`#shortcuts`) — `KEYBOARD_SHORTCUTS[]` grouped (Navigation, Documents, Mail, Chat, Taches)
  7. **System Info** (`#system`) — version info (SignApps v0.1.0, Next.js 16 + React 19, Rust Axum/Tokio) + service status grid with health check
  8. **Documentation Links** — 6 static doc link cards
  9. **Contact Support** (`#contact`) — subject + message form with simulated send
- **State**: `searchQuery`, `openFaqItems` (Set<number>), `contactForm`, `sending`, `serviceStatuses`
- **No Zustand store** — all state is local to the page component
- **Toasts**: uses `sonner` for contact form feedback

### FAQ data (12 items, 8 categories)

| Category | Count |
|---|---|
| Compte | 2 |
| Documents | 2 |
| Mail | 2 |
| Calendrier | 1 |
| Stockage | 1 |
| IA | 1 |
| Securite | 1 |
| Administration | 2 |

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `help-root` | Help page container |
| `help-search` | FAQ search input |
| `help-faq-section` | FAQ card section |
| `help-faq-item-{index}` | Individual FAQ collapsible item |
| `help-shortcuts-section` | Keyboard shortcuts card |
| `help-system-section` | System info card |
| `help-service-{name}` | Service status row |
| `help-check-services-btn` | "Verifier les services" button |
| `help-contact-section` | Contact form card |
| `help-contact-subject` | Subject input |
| `help-contact-message` | Message textarea |
| `help-contact-submit` | Send button |
| `help-whatsnew` | "Quoi de neuf" card |

## Key E2E journeys

1. **Search FAQ** — type "mot de passe" in search, verify only matching FAQ items shown, clear search to restore all
2. **Expand/collapse FAQ** — click a FAQ question, verify answer expands with chevron change, click again to collapse
3. **Health check** — click "Verifier les services", verify each service shows green (online), red (offline), or yellow (checking)
4. **Contact form** — fill subject + message, click send, verify success toast and form clears
5. **Contact validation** — submit empty form, verify error toast "Veuillez remplir tous les champs"
6. **Quick links** — click "FAQ" quick link, verify page scrolls to #faq section

## Common bug patterns

1. **Health check false positives** — uses `mode: 'no-cors'`; opaque response (status 0) is treated as success; service could return 500 and still show "online"
2. **Health check AbortController** — 3-second timeout via `setTimeout(() => controller.abort(), 3000)`; if component unmounts before timeout, `clearTimeout` is not called (no cleanup)
3. **Contact form simulated** — `handleContactSubmit` uses `setTimeout(1000)` to fake sending; no actual API call; messages are lost
4. **FAQ search no-results UX** — shows "Aucun resultat pour..." only inside the FAQ card; rest of page (shortcuts, system) still visible, which may confuse users
5. **Hardcoded version** — "SignApps v0.1.0" and framework versions are hardcoded strings; will become stale
6. **Service list incomplete** — SERVICES array (9 services) does not include all 33 services; major ones like Docs (3010), Calendar (3011), Mail (3012), Chat (3020), Gateway (3099) are missing
7. **FAQ item index collision** — `toggleFaq` uses `FAQ_ITEMS.indexOf(item)` to get global index; if FAQ_ITEMS has duplicate entries, indexOf returns first match

## Debug checklist

- [ ] Page loads without errors? Check browser console for React hydration or import issues
- [ ] FAQ search works? Type in search, verify `filteredFaq` updates
- [ ] Collapsible state? Check `openFaqItems` Set in React DevTools
- [ ] Services reachable? Run health check, inspect `serviceStatuses` state
- [ ] Contact form state? Check `contactForm` and `sending` states
- [ ] No backend dependency? This page works even with all services down (except health check section)

## Dependencies (license check)

- **Frontend**: react, next, sonner, lucide-react — MIT
- Verify: `cd client && npm run license-check:strict`
