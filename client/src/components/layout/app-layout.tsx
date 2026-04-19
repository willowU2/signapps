"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useUIStore } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageTransition } from "@/components/layout/page-transition";
import { cn } from "@/lib/utils";

// AQ-PERF (J1 2026-04-18): the right sidebar and AI chat bar are hidden
// on first paint for every route.  Dynamic-import them so the hefty AI
// chat tree (~60 kB gzipped with `spinners-react`, dropdown-menu, tool-
// call renderer) stays out of the app-shell first-load chunk.
const RightSidebar = dynamic(
  () => import("./right-sidebar").then((m) => m.RightSidebar),
  { ssr: false },
);
const AiChatBar = dynamic(
  () => import("./ai-chat-bar").then((m) => m.AiChatBar),
  { ssr: false },
);
// SO3 — Global ⌘K omnibox. Dynamic import to keep it out of first paint.
const CommandPalette = dynamic(
  () =>
    import("@/components/common/command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);

export type PortalMode = "client" | "supplier" | null;

interface AppLayoutProps {
  children: React.ReactNode;
  portalMode?: PortalMode;
}

export function AppLayout({ children, portalMode }: AppLayoutProps) {
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const rightSidebarPinned = useUIStore((s) => s.rightSidebarPinned);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  useKeyboardShortcuts();

  // Phase 5: Scroll to top on every navigation
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // When right sidebar is pinned open, adjust layout to accommodate the panel
  const rightPanelOpen = rightSidebarOpen || rightSidebarPinned;

  return (
    <div
      className={cn(
        "flex h-screen w-full flex-col overflow-hidden bg-background transition-all duration-200",
        sidebarCollapsed ? "md:pl-16" : "md:pl-64",
        rightPanelOpen ? "md:pr-[24rem]" : "md:pr-16",
      )}
    >
      {/* Skip-link is in root layout.tsx — no duplicate here */}
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — includes its own mobile drawer + backdrop logic */}
        <Sidebar portalMode={portalMode} />

        {/* Main content */}
        <main
          ref={mainRef}
          id="main-content"
          className={cn(
            "flex-1 min-w-0 overflow-y-auto transition-all duration-200 smooth-scroll",
            pathname.startsWith("/mail") ||
              pathname.startsWith("/calendar") ||
              pathname.startsWith("/drive") ||
              pathname.startsWith("/storage") ||
              pathname.startsWith("/tasks") ||
              pathname.startsWith("/whiteboard")
              ? "p-0 bg-background" // Flush layout for full-screen apps
              : "rounded-tl-2xl border-l border-t border-border bg-card p-4 md:p-6 pb-28", // Standard dashboard layout
          )}
        >
          <ErrorBoundary>
            <PageTransition>
              <div className="w-full">{children}</div>
            </PageTransition>
          </ErrorBoundary>
        </main>

        {/* Right sidebar — fixed position, handles its own rendering */}
        <RightSidebar />
      </div>

      <AiChatBar />
      {/* SO3 — Global ⌘K omnibox (mounted once) */}
      <CommandPalette />
    </div>
  );
}
