/**
 * Directory layout — SO5 Mobile Directory.
 *
 * Minimal top-level layout — intentionally *not* nested under `/admin/*` so
 * every authenticated user (not just admins) can open the directory. The
 * layout is deliberately free of the desktop admin sidebar to keep the
 * mobile experience edge-to-edge.
 *
 * Auth guard: handled centrally by `AuthProvider` (`components/auth/
 * auth-provider.tsx`) which kicks unauthenticated visitors back to `/login`
 * for any route outside the allow-list.
 */
import type { ReactNode } from "react";

export default function DirectoryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {children}
    </div>
  );
}
