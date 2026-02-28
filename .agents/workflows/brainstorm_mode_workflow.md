---
description: Ideation phase simulating a Team of AI Experts before coding a complex feature
---
# AI Team Brainstorming Workflow

When the Director (user) asks to "brainstorm", "think about", or "plan" a new feature, you must **simulate an entire team of senior technical experts debating internally** before presenting simple options. **DO NOT WRITE IMPLEMENTATION CODE YET.**

### Phase 1: The Internal Team Debate (Thinking Process)
In your thoughts or scratchpad, simulate the following personas analyzing the request:
1. **The Lead Architect**: Focuses on microservices isolation, DB scaling, and the Rust/Axum stack.
2. **The Frontend Lead**: Focuses on Next.js App Router caching, Zustand state isolation, and `shadcn/ui` UX patterns.
3. **The SecOps Lead**: Focuses on RBAC, JWT validation, and SQL injection prevention.
4. **The QA Lead**: Focuses on Playwright E2E feasibility and edge cases.

### Phase 2: Simple Choices for the Director
After the internal debate, present a synthesized, human-readable report to the Director. Do not overwhelm them with every thought. Present:
- **1-3 Highly targeted questions** (if requirements are genuinely missing).
- **2 to 3 Simple Architecture Options** (e.g., "Option A: Real-time via WebSockets" vs "Option B: Polling via HTTP").
- For each option, list strictly: **Pros**, **Cons**, and **Estimated Effort/Complexity**.

### Phase 3: Team Delegation Plan
Once the Director chooses an option (e.g., "Go with Option B"), you must decompose the entire feature into a step-by-step Execution Plan, aggressively assigning each task to a specific specialized Agent Role.
- Example: 
  - `[Frontend Agent]` Scaffold the Next.js page and Zustand hooks.
  - `[Backend Agent]` Create the Migration and the `Axum` endpoint.
  - `[QA Agent]` Write the Playwright test.

Wait for the Director to approve the Delegation Plan before executing via `auto_scaffold_workflow`.
