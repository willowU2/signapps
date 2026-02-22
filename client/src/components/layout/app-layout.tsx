'use client';

import { useUIStore } from '@/lib/store';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { CommandBar } from './command-bar';
import { RightSidebar } from './right-sidebar';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed, rightSidebarOpen } = useUIStore();

  return (
    <div className="min-h-screen bg-background">
      <CommandBar />
      <Sidebar />
      <RightSidebar />
      <div
        className={cn(
          'flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60',
          // Allocate space for the right sidebar: always 16 (icon bar) + 80 (panel if open)
          rightSidebarOpen ? 'pr-[24rem]' : 'pr-16'
        )}
      >
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
