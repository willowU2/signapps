'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Calendar, MessageSquare, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: Home,
    match: (p: string) => p === '/dashboard' || p === '/',
  },
  {
    label: 'Docs',
    href: '/docs',
    icon: FileText,
    match: (p: string) => p.startsWith('/docs'),
  },
  {
    label: 'Calendar',
    href: '/calendar',
    icon: Calendar,
    match: (p: string) => p.startsWith('/calendar'),
  },
  {
    label: 'Chat',
    href: '/chat',
    icon: MessageSquare,
    match: (p: string) => p.startsWith('/chat'),
  },
  {
    label: 'Menu',
    href: '/apps',
    icon: LayoutGrid,
    match: (p: string) =>
      p.startsWith('/apps') ||
      p.startsWith('/settings') ||
      p.startsWith('/admin'),
  },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        // Only visible on mobile (< 768px)
        'fixed bottom-0 left-0 right-0 z-50',
        'flex md:hidden',
        'h-16 border-t border-border bg-background/95 backdrop-blur-sm',
        'safe-area-inset-bottom', // PWA safe area support
      )}
      aria-label="Mobile navigation"
    >
      {NAV_ITEMS.map(({ label, href, icon: Icon, match }) => {
        const isActive = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2',
              'text-xs font-medium transition-colors',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              className={cn(
                'h-5 w-5 transition-transform',
                isActive && 'scale-110',
              )}
              aria-hidden="true"
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
