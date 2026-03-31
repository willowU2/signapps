'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/lib/store';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { RightSidebar } from './right-sidebar';
import { AiChatBar } from './ai-chat-bar';
import { SkipLink } from '@/components/accessibility/skip-link';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const rightSidebarPinned = useUIStore((s) => s.rightSidebarPinned);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // Phase 5: Scroll to top on every navigation
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // When right sidebar is pinned open, adjust layout to accommodate the panel
  const rightPanelOpen = rightSidebarOpen || rightSidebarPinned;

  return (
    <div className={cn(
      "flex h-screen w-full flex-col overflow-hidden bg-background transition-all duration-200",
      sidebarCollapsed ? "md:pl-16" : "md:pl-64",
      rightPanelOpen ? "md:pr-[24rem]" : "md:pr-16"
    )}>
      <SkipLink />
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — includes its own mobile drawer + backdrop logic */}
        <Sidebar />

        {/* Main content */}
        <main
          ref={mainRef}
          id="main-content"
          className={cn(
            'flex-1 min-w-0 overflow-y-auto rounded-tl-2xl border-l border-t border-border bg-card dark:bg-[#0b0e14] p-4 md:p-6 pb-28 transition-all duration-200'
          )}
        >
          {/* key on pathname forces fade-in to re-trigger on every page navigation */}
          <div key={pathname} className="w-full fade-in">
            {children}
          </div>
        </main>

        {/* Right sidebar — fixed position, handles its own rendering */}
        <RightSidebar />
      </div>

      <AiChatBar />
    </div>
  );
}
