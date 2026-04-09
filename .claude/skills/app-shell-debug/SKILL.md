---
name: app-shell-debug
description: Debug skill for the App Shell & Launcher (/all-apps). Covers AppLayout, Sidebar (pins/labels/sections), Header, CommandBar (Cmd+K), MobileBottomNav, FloatingActionButton, and the all-apps launcher grid with 7 categories.
---

# App Shell & Launcher — Debug Skill

## Source of truth

**`docs/product-specs/48-app-shell.md`** — read spec first.

## Code map

### Frontend (Next.js)

- **Page**: `client/src/app/all-apps/page.tsx` — launcher grid with category filter + search
- **AppLayout**: `client/src/components/layout/app-layout.tsx` — root shell (Sidebar + Header + RightSidebar + AiChatBar)
- **Sidebar**: `client/src/components/layout/sidebar.tsx` — collapsible nav with grouped sections, pinned apps (drag-and-drop reorder), custom labels, hover-to-expand, folders
- **Header**: `client/src/components/layout/header.tsx` — top bar with theme toggle, notifications, breadcrumb labels
- **CommandBar**: `client/src/components/layout/command-bar.tsx` — Cmd+K palette using `cmdk`, omni-search, nav items
- **CommandBar Enhanced**: `client/src/components/layout/command-bar-enhanced.tsx` — extended palette with Universal Blocks
- **MobileBottomNav**: `client/src/components/layout/mobile-bottom-nav.tsx` — 5-tab bottom nav (Home, Mail, Calendar, Tasks, More)
- **FloatingActionButton**: `client/src/components/layout/floating-action-button.tsx` — quick actions (new doc, email, task, note, search)
- **QuickSwitcher**: `client/src/components/layout/quick-switcher.tsx` — recent docs switcher
- **RightSidebar**: `client/src/components/layout/right-sidebar.tsx` — contextual panel (pinnable)
- **AiChatBar**: `client/src/components/layout/ai-chat-bar.tsx` — AI chat overlay
- **AppRegistry**: `client/src/lib/app-registry.ts` — static registry of all apps (AppEntry[]), APP_CATEGORIES
- **useAppRegistry hook**: `client/src/hooks/use-app-registry.ts` — fetches live registry from gateway, fallback to static
- **Stores**: `client/src/lib/store.ts` — `useUIStore` (sidebarCollapsed, rightSidebarOpen, sidebarPinned), `useLabelsStore` (labels CRUD), `usePinnedAppsStore` (pins, folders, reorder)
- **CommandBarStore**: `client/src/stores/command-bar-store.ts` — command palette open state
- **SpotlightCard**: `client/src/components/ui/spotlight-card.tsx` — hover effect card used in all-apps grid

### Backend

- **Gateway**: `signapps-gateway` — port 3099 — provides `/api/v1/discovery` for dynamic app registry
- No dedicated backend service; the shell is purely frontend (state in Zustand + localStorage)

## Key data-testids (to add)

| data-testid | Element |
|---|---|
| `app-shell-sidebar` | Left sidebar container |
| `app-shell-header` | Top header bar |
| `app-shell-main` | Main content area |
| `all-apps-search` | Search input on /all-apps |
| `all-apps-category-{name}` | Category filter button |
| `all-apps-card-{id}` | App card in launcher grid |
| `sidebar-pin-{href}` | Pinned app in sidebar |
| `sidebar-label-{name}` | Custom label in sidebar |
| `sidebar-section-{id}` | Collapsible nav section |
| `command-palette` | Command bar dialog |
| `mobile-bottom-nav` | Mobile bottom navigation bar |
| `fab-button` | Floating action button |

## Key E2E journeys

1. **Launch app from grid** — navigate to /all-apps, search for "Mail", click card, verify redirect to /mail
2. **Category filter** — select "Communication" category, verify only matching apps shown, select "Toutes" to reset
3. **Command palette** — press Cmd+K, type search query, select result, verify navigation
4. **Sidebar pin** — drag app to sidebar, verify pinned section appears, reorder pins, unpin
5. **Sidebar labels** — create label with color, assign to app, filter by label, delete label
6. **Mobile nav** — resize to mobile, verify bottom nav visible with 5 tabs, tap "More" goes to /all-apps
7. **Sidebar collapse** — toggle collapse, verify icons-only mode, hover to expand temporarily

## Common bug patterns

1. **DynIcon fallback** — lucide icon name mismatch between `app-registry.ts` and actual lucide exports; renders fallback Grid icon silently
2. **Sidebar section persistence** — `localStorage.getItem(SECTION_STATE_KEY)` can throw in private browsing; defaults to only "workspace" open
3. **Hover-to-expand flicker** — `handleMouseLeave` fires when cursor enters a tooltip/popover inside sidebar, collapsing it prematurely
4. **Pinned apps lost** — `usePinnedAppsStore` persists to localStorage; clearing storage or SSR hydration mismatch resets pins
5. **Gateway registry fetch failure** — `useAppRegistry` silently falls back to static `APP_REGISTRY`; stale app list if gateway is down but new apps were added
6. **Command palette empty results** — `fetchOmniSearch` requires identity service (port 3001) running; command bar shows only nav items if search API fails
7. **Mobile bottom nav z-index** — bottom nav can overlap with AiChatBar or FAB on small screens
8. **Right sidebar padding** — `AppLayout` applies `md:pr-[24rem]` when right sidebar is open but does not account for collapsed right sidebar (always 16)

## Debug checklist

- [ ] `useUIStore` state correct? Check `sidebarCollapsed`, `sidebarPinned`, `rightSidebarOpen` in React DevTools
- [ ] App registry loaded? Check `useAppRegistry()` returns expected apps count and categories
- [ ] Sidebar sections: inspect `localStorage` key `sidebar-sections-open` for persisted state
- [ ] Pinned apps: inspect `usePinnedAppsStore` state for `pinnedApps` and `folders`
- [ ] Labels: inspect `useLabelsStore` state
- [ ] Command palette: check `useCommandBarStore` `isOpen` state, verify Cmd+K event listener
- [ ] Gateway accessible? `curl http://localhost:3099/api/v1/discovery` for live registry
- [ ] Mobile breakpoint: check Tailwind responsive classes (`md:pl-64`, `md:hidden`)

## Dependencies (license check)

- **Frontend**: react, next, zustand, cmdk, lucide-react — MIT
- Verify: `just deny-licenses && cd client && npm run license-check:strict`
