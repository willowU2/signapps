'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';
import { RightSidebar } from './right-sidebar';
import { AiChatBar } from './ai-chat-bar';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Full-width header */}
      <Header />

      {/* Body: sidebar + main + right strip */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop — only shown when sidebar is open on mobile */}
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Left sidebar */}
        <div
          className={cn(
            // Mobile: fixed overlay, hidden when collapsed
            'fixed inset-y-0 left-0 z-50 md:relative md:z-auto',
            'transition-transform duration-200 md:transition-none md:transform-none',
            // Mobile: slide in/out
            sidebarCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0',
          )}
        >
          <Sidebar />
        </div>

        {/* Main content — fills remaining space */}
        <main className="flex-1 min-w-0 overflow-y-auto rounded-tl-2xl border-l border-t border-border bg-card dark:bg-[#0b0e14] p-4 md:p-6 pb-28 transition-all duration-200">
          <div className="mx-auto max-w-[1600px]">
            {children}
          </div>
        </main>

        {/* Right icon strip — hidden on mobile */}
        <div className="hidden md:block">
          <RightSidebar />
        </div>
      </div>

      {/* AI Chat Bar */}
      <AiChatBar />
    </div>
  );
}
