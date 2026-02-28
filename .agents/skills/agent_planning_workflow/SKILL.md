---
name: agent_planning_workflow
description: Enforces the AI Architect role before implementation
---
# Agent Planning Workflow (Architect Role)

Before you begin executing complex code changes on the SignApps Platform, you MUST act as a "Lead Architect" and adopt this BMAD-inspired workflow:

1. **Understand Context**: Read `STACK.md` and `CONVENTIONS.md` to understand the 8 microservices, 4 shared crates, Next.js frontend, and the rules of the project.
2. **Breakdown**: Create an `implementation_plan.md` in your artifact directory.
3. **Domain Segregation**: Identify exactly which microservice (`services/signapps-*`) or which frontend domain (`client/src/app/*`) must be updated. DO NOT attempt to blindly modify multiple services in a single giant commit.
4. **Data Verification**: If the feature requires a database change, plan the `sqlx-cli` migration (`.up.sql` and `.down.sql`) before writing Rust data access logic.
5. **Review**: Present the plan to the user via the `notify_user` tool before aggressively writing code.
