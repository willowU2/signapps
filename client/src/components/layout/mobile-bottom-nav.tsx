'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Mail, Calendar, MessageSquare, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

// 5-tab bottom navigation per IDEA-095: Home, Mail, Calendar, Chat, More
const NAV_ITEMS = [
  {
    label: 'Home',
    href: '/dashboard',
    icon: Home,
    match: (p: string) => p === '/dashboard' || p === '/',
  },
  {
    label: 'Mail',
    href: '/mail',
    icon: Mail,
    match: (p: string) => p.startsWith('/mail'),
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
    label: 'More',
    href: '/apps',
    icon: LayoutGrid,
    match: (p: string) =>
      p.startsWith('/apps') ||
      p.startsWith('/settings') ||
      p.startsWith('/admin') ||
      p.startsWith('/docs') ||
      p.startsWith('/drive'),
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
        // pb-safe uses env(safe-area-inset-bottom) for notched phones
        'h-16 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,0px)]',
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
              // Larger touch target (min 44px)
              'min-h-[44px]',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              className={cn(
                'h-6 w-6 transition-transform',
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
