'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';
import { RightSidebar } from './right-sidebar';
import { AiChatBar } from './ai-chat-bar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Full-width header */}
      <Header />

      {/* Body: sidebar + main + icon strip */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto rounded-tl-2xl border-l border-t border-border bg-card dark:bg-[#0b0e14] p-6 pb-28">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>

        {/* Right icon strip */}
        <RightSidebar />
      </div>

      {/* AI Chat Bar */}
      <AiChatBar />
    </div>
  );
}
