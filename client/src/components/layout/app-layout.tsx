'use client';

<<<<<<< Updated upstream
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
=======
import { useUIStore } from '@/lib/store';
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // Phase 5: Scroll to top on every navigation
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);
=======
  const { sidebarCollapsed, rightSidebarOpen } = useUIStore();
>>>>>>> Stashed changes

  return (
    <div className={cn(
      "flex h-screen flex-col overflow-hidden bg-background transition-all duration-200",
      sidebarCollapsed ? "md:pl-16" : "md:pl-64",
      rightSidebarOpen ? "md:pr-[24rem]" : "md:pr-16"
    )}>
      <SkipLink />
      <Header />

<<<<<<< Updated upstream
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
=======
      {/* Body: sidebar + main + right icon strip */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — fixed, out-of-flow */}
        <Sidebar />

        {/* Main content — padded to avoid being hidden under fixed sidebars */}
        <main
          className={[
            'flex-1 overflow-y-auto rounded-tl-2xl border-l border-t border-border bg-card dark:bg-[#0b0e14] p-6 pb-28 min-w-0 transition-all duration-200',
            // Left padding — mobile has no sidebar so no padding
            sidebarCollapsed ? 'md:pl-16' : 'md:pl-64',
            // Right padding — always account for the fixed icon bar (w-16), plus panel width when open
            rightSidebarOpen ? 'md:pr-[calc(4rem+20rem)]' : 'md:pr-16',
          ].join(' ')}
        >
          <div className="mx-auto max-w-[1600px]">
>>>>>>> Stashed changes
            {children}
          </div>
        </main>

<<<<<<< Updated upstream
        {/* Right sidebar — fixed position, handles its own rendering */}
=======
        {/* Right sidebar — fixed */}
>>>>>>> Stashed changes
        <RightSidebar />
      </div>

      <AiChatBar />
    </div>
  );
}
