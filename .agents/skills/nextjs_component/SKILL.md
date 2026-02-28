---
name: nextjs_component
description: How to create a React/Next.js frontend component
---
# Creating a Next.js Component

1. **Location**: `client/src/components/` (use `ui/` for Shadcn, others grouped by feature).
2. **Naming**: `kebab-case.tsx` for file name, `PascalCase` for exported component.
3. **Directive**: Use `'use client';` at the top ONLY if the component uses hooks (useState, useEffect) or event listeners. Otherwise, leave it as a Server Component.
4. **Props**: Define an `interface ComponentNameProps` for props.
5. **State & Fetching**: 
   - Global state: Zustand (`client/src/lib/store.ts`).
   - Data fetching: Custom hooks in `client/src/hooks/` wrapping React Query (e.g., `useContainers()`).
   - Hooks should be named `use-hook-name.ts`.
6. **Imports**: Always use `@/` path aliases for internal imports (e.g., `import { Button } from '@/components/ui/button';`).
