'use client';

import { useUIStore, useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  Moon,
  Sun,
  Menu,
  Search,
  SlidersHorizontal,
  HelpCircle,
  Settings,
  LayoutGrid,
  FileText,
  Loader2,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { useAiSearch } from '@/hooks/use-ai-search';

// SSR-safe mounted check without setState-in-effect
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function Header() {
  const { theme, setTheme, toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: results, isLoading: searchLoading, isError: searchError } = useAiSearch(debouncedQuery);

  const handleSearchSubmit = useCallback(() => {
    if (!searchQuery.trim()) return;
    const q = encodeURIComponent(searchQuery.trim());
    setSearchOpen(false);
    router.push(`/ai?q=${q}`);
  }, [searchQuery, router]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const showDropdown = searchOpen && debouncedQuery.length >= 2;

  return (
    <header className="h-16 flex shrink-0 items-center justify-between px-4 bg-card dark:bg-background border-b border-border z-50">
      {/* Left: hamburger + logo */}
      <div className="flex items-center gap-4 min-w-[240px]">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="rounded-full"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Right: actions */}
      <div className="flex items-center gap-1 min-w-[240px] justify-end">
        <NotificationPopover />

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground"
          onClick={() => router.push('/settings')}
          title="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground"
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
          className="rounded-full text-muted-foreground mr-2"
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
