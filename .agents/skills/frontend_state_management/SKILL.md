---
name: frontend_state_management
description: Rules for using Zustand, React Query, and Axios in Next.js
---
# Frontend State Management (Next.js)

When working on the `client/` directory, adhere strictly to these frontend rules:

1. **No Redux**: We use **Zustand** for global client state (e.g., Auth, Theme). 
   - Location: `client/src/lib/store.ts`
   - Use `persist` middleware if the data needs to survive reloads (e.g., JWT token, user info).
2. **Server State**: Use **TanStack React Query** for fetching, caching, and updating asynchronous data.
   - Location: Create custom hooks in `client/src/hooks/use-[feature].ts`.
   - Pattern: Wrap `axios` calls within `useQuery` or `useMutation`.
3. **Axios Interceptors**: The API client is configured at `client/src/lib/api.ts`. It auto-injects the JWT token. Use this exported instance instead of standard `fetch()`.
4. **Server Components vs Client Components**: 
   - Prefer React Server Components (RSC) by default.
   - Only add `'use client';` to files that need `useState`, `useEffect`, `onClick`, or custom React hooks. Keep boundary pushed to the leaves of the component tree.
