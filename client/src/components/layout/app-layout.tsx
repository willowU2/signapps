'use client';

import { useUIStore } from '@/lib/store';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { GlobalHeader } from './global-header';
import { CommandBar } from './command-bar';
import { RightSidebar } from './right-sidebar';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed, rightSidebarOpen } = useUIStore();
  const pathname = usePathname();

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
        {pathname === '/dashboard' ? <Header /> : <GlobalHeader />}
        <main className="flex-1 p-6 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-full w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
