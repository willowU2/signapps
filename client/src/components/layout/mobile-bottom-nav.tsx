'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Mail, Calendar, CheckSquare, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

// 5-tab bottom navigation: Home, Mail, Calendar, Tasks, More
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
    href: '/cal',
    icon: Calendar,
    match: (p: string) => p.startsWith('/cal'),
  },
  {
    label: 'Tasks',
    href: '/tasks',
    icon: CheckSquare,
    match: (p: string) => p.startsWith('/tasks'),
  },
  {
    label: 'More',
    href: '/all-apps',
    icon: LayoutGrid,
    match: (p: string) =>
      p.startsWith('/all-apps') ||
      p.startsWith('/apps') ||
      p.startsWith('/settings') ||
      p.startsWith('/admin') ||
      p.startsWith('/docs') ||
      p.startsWith('/drive'),
  },
] as const;

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

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
            onClick={triggerHaptic}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2',
              'text-xs font-medium transition-colors',
              // Larger touch target (min 44px per WCAG)
              'min-h-[44px]',
              'active:scale-95 transition-transform duration-100',
              isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Active indicator pill above icon */}
            {isActive && (
              <span
                className="absolute top-1 h-1 w-6 rounded-full bg-primary animate-in fade-in zoom-in-75 duration-200"
                aria-hidden="true"
              />
            )}
            <Icon
              className={cn(
                'h-5 w-5 transition-transform duration-150',
                isActive && 'scale-110',
              )}
              aria-hidden="true"
            />
            <span className={cn('leading-tight', isActive && 'font-semibold')}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
