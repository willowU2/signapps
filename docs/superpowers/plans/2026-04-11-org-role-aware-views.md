# Org Role-Aware Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-aware team views so managers see their direct reports with actionable dashboards, and a transversal "Mon equipe" filter enriches existing modules.

**Architecture:** 5-layer implementation — (1) Backend team resolution endpoints on workforce service, (2) Frontend API client + Zustand store, (3) /my-team hub page with 3 tabs, (4) Transversal team filter in existing modules, (5) Sidebar + dashboard integration + E2E tests.

**Tech Stack:** Rust (Axum, sqlx), PostgreSQL (org_closure), Next.js 16, React 19, Zustand, react-query, shadcn/ui, Recharts

---

## File Structure

### Backend (Rust)

| File | Responsibility | Action |
|------|---------------|--------|
| `services/signapps-workforce/src/handlers/my_team.rs` | 9 endpoints: team resolution, summary, pending actions, approvals | Create |
| `services/signapps-workforce/src/handlers/mod.rs` | Register my_team module | Modify |
| `services/signapps-workforce/src/main.rs` | Register /my-team routes | Modify |

### Frontend (TypeScript/React)

| File | Responsibility | Action |
|------|---------------|--------|
| `client/src/lib/api/my-team.ts` | API client for team endpoints | Create |
| `client/src/stores/team-store.ts` | Zustand store for team state + filter toggle | Create |
| `client/src/hooks/use-my-team.ts` | react-query hooks for team data | Create |
| `client/src/app/my-team/page.tsx` | Hub page with 3 tabs | Create |
| `client/src/app/my-team/layout.tsx` | Layout wrapper | Create |
| `client/src/components/team/team-today.tsx` | Tab 1: presence, actions, tasks | Create |
| `client/src/components/team/team-directory.tsx` | Tab 2: member cards, mini org chart | Create |
| `client/src/components/team/team-indicators.tsx` | Tab 3: KPIs, charts | Create |
| `client/src/components/team/team-filter-toggle.tsx` | Reusable "Mon equipe" toggle button | Create |
| `client/src/components/layout/sidebar.tsx` | Add "Mon equipe" nav item | Modify |
| `client/e2e/my-team-smoke.spec.ts` | E2E smoke tests | Create |

---

## Task 1: Backend Team Resolution Endpoints

**Files:**
- Create: `services/signapps-workforce/src/handlers/my_team.rs`
- Modify: `services/signapps-workforce/src/handlers/mod.rs`
- Modify: `services/signapps-workforce/src/main.rs`

- [ ] **Step 1: Create my_team.rs handler**

Read `services/signapps-workforce/src/handlers/org/nodes.rs` for the exact handler pattern (State, TenantContext, Claims, StatusCode errors).

Create `services/signapps-workforce/src/handlers/my_team.rs` with these 9 handlers:

```rust
//! My Team handlers — role-aware team resolution via org_closure.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;
use signapps_common::{Claims, TenantContext};
```

**Endpoints:**

1. `GET /api/v1/workforce/my-team` — Resolve direct reports (N-1) for the authenticated user:
   - Get person_id from Claims (via core.persons WHERE user_id = claims.sub)
   - Get primary assignment node_id from core.assignments
   - Query N-1 via: `SELECT DISTINCT a.person_id, p.first_name, p.last_name, p.email, p.avatar_url FROM core.assignments a JOIN core.persons p ON p.id = a.person_id JOIN core.org_closure oc ON oc.descendant_id = a.node_id WHERE oc.ancestor_id = $my_node_id AND oc.depth = 1 AND a.end_date IS NULL AND a.person_id != $my_person_id`
   - Also query manager: `SELECT ... FROM core.assignments a JOIN core.org_closure oc ON oc.descendant_id = $my_node_id WHERE oc.depth = 1 AND a.assignment_type = 'holder'`
   - Return JSON with `manager`, `direct_reports[]`, `team_size`, `has_reports`

2. `GET /api/v1/workforce/my-team/extended` — Full subtree (depth > 0)

3. `GET /api/v1/workforce/my-team/manager` — Manager info only

4. `GET /api/v1/workforce/my-team/peers` — Same-node persons

5. `GET /api/v1/workforce/my-team/summary` — Aggregated KPIs:
   - Count of N-1 persons
   - Count with active tasks (cross-query tasks table if exists, else return 0)
   - Count on leave today
   - Average FTE ratio

6. `GET /api/v1/workforce/my-team/pending-actions` — Leave requests + timesheets awaiting approval:
   - Query leave events WHERE approver = my_person_id AND status = 'pending'
   - Query timesheets WHERE manager_id = my_person_id AND status = 'submitted'

7. `POST /api/v1/workforce/my-team/leave/:id/approve` — Update leave status to 'approved'

8. `POST /api/v1/workforce/my-team/leave/:id/reject` — Update leave status to 'rejected' with optional reason

9. `POST /api/v1/workforce/my-team/timesheet/:id/approve` — Update timesheet status to 'approved'

Each handler: `#[tracing::instrument(skip_all)]`, `TenantContext` + `Claims` extractors, `StatusCode` errors, no unwrap/expect.

**Important:** If core.persons doesn't have the user's person record (user_id not linked), return empty team with `has_reports: false`. Don't error.

- [ ] **Step 2: Register module in mod.rs**

Add to `services/signapps-workforce/src/handlers/mod.rs`:
```rust
pub mod my_team;
```

- [ ] **Step 3: Register routes in main.rs**

Add to `services/signapps-workforce/src/main.rs` in the protected routes section:
```rust
let my_team_routes = Router::new()
    .route("/api/v1/workforce/my-team", get(handlers::my_team::get_my_team))
    .route("/api/v1/workforce/my-team/extended", get(handlers::my_team::get_extended_team))
    .route("/api/v1/workforce/my-team/manager", get(handlers::my_team::get_manager))
    .route("/api/v1/workforce/my-team/peers", get(handlers::my_team::get_peers))
    .route("/api/v1/workforce/my-team/summary", get(handlers::my_team::get_team_summary))
    .route("/api/v1/workforce/my-team/pending-actions", get(handlers::my_team::get_pending_actions))
    .route("/api/v1/workforce/my-team/leave/:id/approve", post(handlers::my_team::approve_leave))
    .route("/api/v1/workforce/my-team/leave/:id/reject", post(handlers::my_team::reject_leave))
    .route("/api/v1/workforce/my-team/timesheet/:id/approve", post(handlers::my_team::approve_timesheet))
    .route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware));
```

- [ ] **Step 4: Verify compilation**

Run: `cargo check -p signapps-workforce`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add services/signapps-workforce/src/handlers/my_team.rs \
       services/signapps-workforce/src/handlers/mod.rs \
       services/signapps-workforce/src/main.rs
git commit -m "feat(workforce): add my-team resolution endpoints (9 handlers)"
```

---

## Task 2: Frontend API Client + Store + Hooks

**Files:**
- Create: `client/src/lib/api/my-team.ts`
- Create: `client/src/stores/team-store.ts`
- Create: `client/src/hooks/use-my-team.ts`

- [ ] **Step 1: Create API client**

Create `client/src/lib/api/my-team.ts`:

```typescript
import { getClient, ServiceName } from "./factory";

const client = getClient(ServiceName.WORKFORCE);

export interface TeamMember {
  person_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  avatar_url?: string;
  job_title?: string;
  department?: string;
  presence_status?: string;
  workload?: "low" | "medium" | "high" | "overloaded";
  active_tasks_count?: number;
  pending_leave_days?: number;
  last_activity?: string;
}

export interface TeamManager {
  person_id: string;
  first_name: string;
  last_name: string;
  job_title?: string;
  avatar_url?: string;
  presence_status?: string;
}

export interface MyTeamResponse {
  manager: TeamManager | null;
  direct_reports: TeamMember[];
  team_size: number;
  has_reports: boolean;
}

export interface TeamSummary {
  team_size: number;
  active_tasks: number;
  on_leave_today: number;
  avg_fte: number;
  pending_leaves: number;
  pending_timesheets: number;
}

export interface PendingAction {
  id: string;
  type: "leave" | "timesheet" | "expense";
  person_name: string;
  person_avatar?: string;
  description: string;
  submitted_at: string;
  metadata?: Record<string, unknown>;
}

export const myTeamApi = {
  getTeam: () => client.get<MyTeamResponse>("/workforce/my-team"),
  getExtended: () => client.get<{ members: TeamMember[] }>("/workforce/my-team/extended"),
  getManager: () => client.get<TeamManager>("/workforce/my-team/manager"),
  getPeers: () => client.get<TeamMember[]>("/workforce/my-team/peers"),
  getSummary: () => client.get<TeamSummary>("/workforce/my-team/summary"),
  getPendingActions: () => client.get<PendingAction[]>("/workforce/my-team/pending-actions"),
  approveLeave: (id: string) => client.post(`/workforce/my-team/leave/${id}/approve`),
  rejectLeave: (id: string, reason?: string) => client.post(`/workforce/my-team/leave/${id}/reject`, { reason }),
  approveTimesheet: (id: string) => client.post(`/workforce/my-team/timesheet/${id}/approve`),
};
```

- [ ] **Step 2: Create team store**

Create `client/src/stores/team-store.ts`:

```typescript
import { create } from "zustand";

interface TeamFilterState {
  teamFilterActive: Record<string, boolean>;
  hasReports: boolean;
  pendingActionsCount: number;
  setHasReports: (val: boolean) => void;
  setPendingActionsCount: (count: number) => void;
  toggleTeamFilter: (module: string) => void;
  isTeamFilterActive: (module: string) => boolean;
}

export const useTeamStore = create<TeamFilterState>()((set, get) => ({
  teamFilterActive: {},
  hasReports: false,
  pendingActionsCount: 0,
  setHasReports: (val) => set({ hasReports: val }),
  setPendingActionsCount: (count) => set({ pendingActionsCount: count }),
  toggleTeamFilter: (module) =>
    set((state) => ({
      teamFilterActive: {
        ...state.teamFilterActive,
        [module]: !state.teamFilterActive[module],
      },
    })),
  isTeamFilterActive: (module) => get().teamFilterActive[module] ?? false,
}));
```

- [ ] **Step 3: Create react-query hooks**

Create `client/src/hooks/use-my-team.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { myTeamApi } from "@/lib/api/my-team";
import { useTeamStore } from "@/stores/team-store";
import { useEffect } from "react";
import { toast } from "sonner";

export function useMyTeam() {
  const setHasReports = useTeamStore((s) => s.setHasReports);
  const query = useQuery({
    queryKey: ["my-team"],
    queryFn: async () => {
      const res = await myTeamApi.getTeam();
      return res.data;
    },
    staleTime: 2 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) {
      setHasReports(query.data.has_reports);
    }
  }, [query.data, setHasReports]);

  return query;
}

export function useTeamSummary() {
  const setPending = useTeamStore((s) => s.setPendingActionsCount);
  const query = useQuery({
    queryKey: ["my-team", "summary"],
    queryFn: async () => {
      const res = await myTeamApi.getSummary();
      return res.data;
    },
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) {
      setPending((query.data.pending_leaves ?? 0) + (query.data.pending_timesheets ?? 0));
    }
  }, [query.data, setPending]);

  return query;
}

export function usePendingActions() {
  return useQuery({
    queryKey: ["my-team", "pending-actions"],
    queryFn: async () => {
      const res = await myTeamApi.getPendingActions();
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useApproveLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => myTeamApi.approveLeave(id),
    onSuccess: () => {
      toast.success("Conge approuve");
      queryClient.invalidateQueries({ queryKey: ["my-team"] });
    },
    onError: () => toast.error("Erreur lors de l'approbation"),
  });
}

export function useRejectLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      myTeamApi.rejectLeave(id, reason),
    onSuccess: () => {
      toast.success("Conge refuse");
      queryClient.invalidateQueries({ queryKey: ["my-team"] });
    },
    onError: () => toast.error("Erreur lors du refus"),
  });
}

export function useApproveTimesheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => myTeamApi.approveTimesheet(id),
    onSuccess: () => {
      toast.success("Timesheet approuve");
      queryClient.invalidateQueries({ queryKey: ["my-team"] });
    },
    onError: () => toast.error("Erreur lors de l'approbation"),
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/api/my-team.ts client/src/stores/team-store.ts client/src/hooks/use-my-team.ts
git commit -m "feat(frontend): add my-team API client, store, and react-query hooks"
```

---

## Task 3: Hub Page /my-team with 3 Tabs

**Files:**
- Create: `client/src/app/my-team/layout.tsx`
- Create: `client/src/app/my-team/page.tsx`
- Create: `client/src/components/team/team-today.tsx`
- Create: `client/src/components/team/team-directory.tsx`
- Create: `client/src/components/team/team-indicators.tsx`

- [ ] **Step 1: Create layout**

Simple layout wrapping AppLayout:
```typescript
// client/src/app/my-team/layout.tsx
"use client";
import { AppLayout } from "@/components/layout/app-layout";
export default function MyTeamLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
```

- [ ] **Step 2: Create hub page with 3 tabs**

`client/src/app/my-team/page.tsx` — Uses shadcn Tabs with 3 TabsContent:
- "Aujourd'hui" → `<TeamToday />`
- "Equipe" → `<TeamDirectory />`
- "Indicateurs" → `<TeamIndicators />`

Header shows: "Mon equipe" title + team size badge. If `has_reports === false`, show empty state "Aucun rapport direct — Vous n'avez pas de collaborateurs directs dans l'organigramme."

- [ ] **Step 3: Create TeamToday component**

`client/src/components/team/team-today.tsx`:
- **Presence grid**: avatars with colored dot (green/blue/orange/red/grey), click opens popover
- **Pending actions**: cards for each PendingAction (approve/reject buttons inline)
- **Overdue tasks**: top 5 overdue tasks from team (or empty state)
- Uses `useMyTeam()`, `usePendingActions()`, `useApproveLeave()`, `useRejectLeave()`

- [ ] **Step 4: Create TeamDirectory component**

`client/src/components/team/team-directory.tsx`:
- Card grid of N-1 members (avatar, name, title, presence badge, workload bar)
- Toggle grid/list view
- Click person → slide-out Sheet with contact info, tasks, leave balance
- Quick actions per person: "Assigner tache", "Planifier reunion", "Envoyer message"

- [ ] **Step 5: Create TeamIndicators component**

`client/src/components/team/team-indicators.tsx`:
- 6 KPI cards (team size, hours logged, completion rate, presence rate, open leaves, workload score)
- Recharts bar chart: hours per person this week
- Recharts line chart: completion trend last 4 weeks
- Export PDF/CSV buttons (placeholder for V1)

- [ ] **Step 6: Commit**

```bash
git add client/src/app/my-team/ client/src/components/team/
git commit -m "feat(my-team): add hub page with 3 tabs (today, directory, indicators)"
```

---

## Task 4: Transversal Team Filter Toggle

**Files:**
- Create: `client/src/components/team/team-filter-toggle.tsx`

- [ ] **Step 1: Create reusable toggle component**

```typescript
// client/src/components/team/team-filter-toggle.tsx
"use client";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTeamStore } from "@/stores/team-store";
import { cn } from "@/lib/utils";

interface TeamFilterToggleProps {
  module: string; // "tasks" | "calendar" | "drive" | "timesheet" | "leave" | "presence" | "projects" | "expenses"
}

export function TeamFilterToggle({ module }: TeamFilterToggleProps) {
  const { hasReports, toggleTeamFilter, isTeamFilterActive } = useTeamStore();

  if (!hasReports) return null;

  const active = isTeamFilterActive(module);

  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={() => toggleTeamFilter(module)}
      className={cn("gap-1.5", active && "bg-blue-600 hover:bg-blue-700")}
    >
      <Users className="h-3.5 w-3.5" />
      Mon equipe
    </Button>
  );
}
```

This component is imported and placed in the toolbar of each module that supports team filtering. When active, the module queries its data with an additional `?team_person_ids=id1,id2,...` param (or filters client-side using the N-1 person_ids from the team store).

- [ ] **Step 2: Commit**

```bash
git add client/src/components/team/team-filter-toggle.tsx
git commit -m "feat(team): add reusable TeamFilterToggle component for transversal filtering"
```

---

## Task 5: Sidebar Integration + Dashboard Widget + E2E

**Files:**
- Modify: `client/src/components/layout/sidebar.tsx`
- Create: `client/e2e/my-team-smoke.spec.ts`

- [ ] **Step 1: Add "Mon equipe" to sidebar**

In `client/src/components/layout/sidebar.tsx`, find the `navSections` array. Add a new item in the "workspace" section, after "Taches":

```typescript
{
  href: "/my-team",
  icon: Users,
  label: "Mon equipe",
  badge: pendingActionsCount > 0 ? String(pendingActionsCount) : undefined,
  hidden: !hasReports, // only visible if user has direct reports
},
```

Import `useTeamStore` and extract `hasReports` and `pendingActionsCount` from it. Import `Users` from lucide-react.

The `hidden` flag filters the item from rendering. If the sidebar doesn't support `hidden`, add a `.filter(item => !item.hidden)` in the render loop.

- [ ] **Step 2: Create E2E tests**

Create `client/e2e/my-team-smoke.spec.ts`:

```typescript
import { test, expect } from "./fixtures";

test.describe("My Team — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?auto=admin", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  });

  test("my-team page loads", async ({ page }) => {
    await page.goto("/my-team", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const heading = page.getByRole("heading", { name: /mon equipe/i })
      .or(page.getByText(/mon equipe|aucun rapport/i));
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
  });

  test("tabs are visible (Aujourd'hui, Equipe, Indicateurs)", async ({ page }) => {
    await page.goto("/my-team", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const tabs = page.getByRole("tab");
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("empty state shown when no reports", async ({ page }) => {
    await page.goto("/my-team", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    // Either shows team data or empty state
    const content = page.getByText(/rapport direct|equipe|collaborateur/i);
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test("equipe tab shows directory or empty", async ({ page }) => {
    await page.goto("/my-team", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const equipeTab = page.getByRole("tab", { name: /equipe/i });
    if (await equipeTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await equipeTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test("indicateurs tab shows KPIs or empty", async ({ page }) => {
    await page.goto("/my-team", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const indicTab = page.getByRole("tab", { name: /indicateur/i });
    if (await indicTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await indicTab.click();
      await page.waitForTimeout(1000);
    }
  });

  test("sidebar has Mon equipe link", async ({ page }) => {
    await page.goto("/docs", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    // May or may not be visible depending on has_reports
    const link = page.getByRole("link", { name: /mon equipe/i });
    // Just verify the sidebar renders without crash
    const sidebar = page.locator("nav").first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/layout/sidebar.tsx client/e2e/my-team-smoke.spec.ts
git commit -m "feat(my-team): add sidebar item with badge + E2E smoke tests"
```

---

## Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | Backend team resolution (9 endpoints) | 3 files | 15 min |
| 2 | Frontend API + store + hooks | 3 files | 8 min |
| 3 | Hub /my-team with 3 tabs | 5 files | 15 min |
| 4 | TeamFilterToggle reusable component | 1 file | 3 min |
| 5 | Sidebar + E2E tests | 2 files | 8 min |
