'use client';

import { Header } from './header';
import { GlobalHeader } from './global-header';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { GlobalDndProvider } from './dnd-provider';
import { WorkspaceShell } from './workspace-shell';
import { OmniSearch } from '@/components/ui/omni-search';
import { Breadcrumbs } from '@/components/breadcrumbs';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();

  return (
    <GlobalDndProvider>
      <WorkspaceShell
        className="bg-background"
        header={pathname === '/dashboard' ? <Header /> : <GlobalHeader />}
      >
        <main className="flex-1 p-6 relative overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 transition-colors">
          <Breadcrumbs />
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
      </WorkspaceShell>
      <OmniSearch />
    </GlobalDndProvider>
  );
}
