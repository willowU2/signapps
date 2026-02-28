---
description: Automated boilerplate generation for new features
---
# Auto-Scaffold Workflow

When the Director validates a feature implementation plan (often after Brainstorming), use this workflow to instantly generate all boilerplate across the stack.

### Step 1: Frontend Scaffold (`client/`)
// turbo-all
- Create the Next.js App Router page (`client/src/app/[feature]/page.tsx`).
- Create an empty Zustand store slice if global state is needed (`client/src/lib/store.ts`).
- Create an empty React Query hook (`client/src/hooks/use-[feature].ts`).
- Create a Playwright test stub (`client/e2e/[feature].spec.ts`).

### Step 2: Backend Scaffold (`services/` & `crates/`)
// turbo-all
- Create the SQLx migration file using `sqlx migrate add <feature_name>`.
- Create an empty Repository unit struct in `crates/signapps-db/src/repositories/`.
- Create an empty Axum handler file in `services/[target-service]/src/handlers/`.
- Register the empty route in the microservice's main `Router`.

### Step 3: Reporting
- Report to the Director: "Boilerplate generated across frontend and backend. Commencing business logic implementation on Autopilot."
- Proceed immediately to write the inner logic.
