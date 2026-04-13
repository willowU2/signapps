"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { RightSidebar } from "./right-sidebar";
import { AiChatBar } from "./ai-chat-bar";
import { SkipLink } from "@/components/accessibility/skip-link";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageTransition } from "@/components/layout/page-transition";
import { cn } from "@/lib/utils";

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
      <SkipLink />
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — includes its own mobile drawer + backdrop logic */}
        <Sidebar portalMode={portalMode} />

        {/* Main content */}
        <main
          ref={mainRef}
          id="main-content"
          className={cn(
            "flex-1 min-w-0 overflow-y-auto rounded-tl-2xl border-l border-t border-border bg-card p-4 md:p-6 pb-28 transition-all duration-200 smooth-scroll",
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
    </div>
  );
}
