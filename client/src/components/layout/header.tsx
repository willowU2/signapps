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

      {/* Center: search bar with AI dropdown */}
      <div className="flex-1 max-w-3xl px-8" ref={searchRef}>
        <div className="relative">
          <div className="search-container flex items-center bg-muted dark:bg-muted rounded-lg px-4 py-2 w-full">
            <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
            <input
              className="bg-transparent border-none focus:ring-0 focus:outline-none w-full text-sm placeholder:text-muted-foreground text-foreground"
              placeholder="Rechercher dans SignApps (IA locale)..."
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => {
                if (debouncedQuery.length >= 2) setSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchSubmit();
                }
                if (e.key === 'Escape') {
                  setSearchOpen(false);
                }
              }}
            />
            {searchLoading && debouncedQuery.length >= 2 && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2 shrink-0" />
            )}
            <button className="p-1 rounded-full hover:bg-background dark:hover:bg-accent text-muted-foreground transition-colors shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {/* Search results dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
              {searchLoading ? (
                <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recherche sémantique en cours...
                </div>
              ) : searchError ? (
                <div className="flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground">
                  <WifiOff className="h-4 w-4" />
                  Service IA indisponible
                </div>
              ) : results && results.length > 0 ? (
                <div className="max-h-80 overflow-y-auto">
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-muted-foreground border-b border-border">
                    {results.length} résultat{results.length > 1 ? 's' : ''} — Recherche sémantique
                  </div>
                  {results.map((result) => (
                    <button
                      key={result.id}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                      onClick={() => {
                        setSearchOpen(false);
                        // Navigate to storage if it's a file, or to AI with the query
                        router.push(`/ai?q=${encodeURIComponent(searchQuery)}`);
                      }}
                    >
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{result.filename}</span>
                          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {Math.round(result.score * 100)}%
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {result.content.slice(0, 120)}...
                        </p>
                      </div>
                    </button>
                  ))}
                  {/* Footer: full AI search */}
                  <button
                    className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-sm text-primary transition-colors hover:bg-muted"
                    onClick={handleSearchSubmit}
                  >
                    <Sparkles className="h-4 w-4" />
                    Demander à l&apos;IA : &quot;{searchQuery}&quot;
                  </button>
                </div>
              ) : debouncedQuery.length >= 2 ? (
                <div className="px-4 py-4">
                  <p className="text-sm text-muted-foreground">Aucun résultat pour &quot;{debouncedQuery}&quot;</p>
                  <button
                    className="mt-2 flex items-center gap-2 text-sm text-primary hover:underline"
                    onClick={handleSearchSubmit}
                  >
                    <Sparkles className="h-4 w-4" />
                    Poser la question à l&apos;IA
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

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
