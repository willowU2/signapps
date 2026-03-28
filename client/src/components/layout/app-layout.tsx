'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { RightSidebar } from './right-sidebar';
import { AiChatBar } from './ai-chat-bar';
import { SkipLink } from '@/components/accessibility/skip-link';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // Phase 5: Scroll to top on every navigation
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className={cn(
      "flex h-screen flex-col overflow-hidden bg-background transition-all duration-200",
      sidebarCollapsed ? "md:pl-16" : "md:pl-64",
      rightSidebarOpen ? "md:pr-[24rem]" : "md:pr-16"
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
          <div className="w-full fade-in">
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
