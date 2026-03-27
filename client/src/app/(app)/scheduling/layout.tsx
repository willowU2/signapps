'use client';

import * as React from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function SchedulingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const rightSidebarOpen = useUIStore((state) => state.rightSidebarOpen);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Use default values until mounted to avoid hydration issues
  const paddingLeft = mounted ? (sidebarCollapsed ? 'pl-16' : 'pl-60') : 'pl-60';
  const paddingRight = mounted && rightSidebarOpen ? 'pr-96' : '';

  return (
    <TooltipProvider>
      <div
        className={cn(
          'h-screen w-screen overflow-hidden transition-all duration-300',
          paddingLeft,
          paddingRight
        )}
      >
        {children}
      </div>
    </TooltipProvider>
  );
}
