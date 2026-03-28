'use client';

import { useUIStore, useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  Moon,
  Sun,
  Menu,
  HelpCircle,
  Settings,
  LayoutGrid,
} from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { ChangelogDialog } from '@/components/onboarding/ChangelogDialog';

// SSR-safe mounted check without setState-in-effect
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function Header() {
  const { theme, setTheme, toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Branding from localStorage (set by InstanceBranding settings)
  const [instanceLogo, setInstanceLogo] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  useEffect(() => {
    setInstanceLogo(localStorage.getItem('signapps_instance_logo'));
    setInstanceName(localStorage.getItem('signapps_instance_name'));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme, mounted]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="h-16 flex shrink-0 items-center justify-between px-4 bg-card dark:bg-background border-b border-border z-50">
      {/* Left: hamburger + logo */}
      <div className="flex items-center gap-2 md:gap-4 md:min-w-[240px]">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="rounded-full"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted"
          title="Tableau de bord"
        >
          {instanceLogo ? (
            <img
              src={instanceLogo}
              alt={instanceName ?? 'Logo'}
              className="h-8 w-8 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              S
            </div>
          )}
          <h1 className="text-xl font-medium text-foreground/80 tracking-tight">
            {instanceName ?? 'SignApps'}
          </h1>
        </button>
      </div>

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Right: actions */}
      <div className="flex items-center gap-1 md:min-w-[240px] justify-end">
        <span className="hidden md:inline-flex"><ChangelogDialog /></span>
        <NotificationPopover />

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex rounded-full text-muted-foreground"
          onClick={() => router.push('/settings')}
          title="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex rounded-full text-muted-foreground"
          onClick={() => router.push('/settings')}
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-full text-muted-foreground"
        >
          {mounted && theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex rounded-full text-muted-foreground mr-2"
          title="Apps"
        >
          <LayoutGrid className="h-5 w-5" />
        </Button>

        {/* User avatar */}
        <button
          onClick={() => router.push('/settings/profile')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/30 text-xs font-semibold text-primary"
        >
          {getInitials(user?.display_name || user?.username)}
        </button>
      </div>
    </header>
  );
}
