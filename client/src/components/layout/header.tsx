'use client';

import { useAuthStore, useUIStore } from '@/lib/store';
import { useTenantStore } from '@/stores/tenant-store';
import { usePresenceStore } from '@/stores/presence-store';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarGroup, AvatarMore } from '@/components/shadcnblocks/avatar-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Moon, Sun, Menu, LogOut, User, Settings, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { NotificationBadge } from '@/components/notifications/notification-badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotificationsSSE } from '@/hooks/use-notifications-sse';

export function Header() {
  useNotificationsSSE();
  const { user, logout } = useAuthStore();
  const { toggleSidebar, sidebarCollapsed } = useUIStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { currentWorkspace, members, fetchMembers } = useTenantStore();
  const presenceUsers = usePresenceStore((state) => state.users);

  // Filter members actively connected to the same workspace/page
  const onlineUserIds = Array.from(presenceUsers.values())
    .filter(u => u.isOnline)
    .map(u => u.userId);

  const otherMembers = members.filter(m => 
    m.user_id !== user?.id && onlineUserIds.includes(m.user_id)
  );
  
  const displayedMembers = otherMembers.slice(0, 3);
  const hiddenMembers = otherMembers.slice(3);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme, mounted]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const labelMap: Record<string, string> = {
      cal: 'Calendrier',
      dashboard: 'Dashboard',
      docs: 'Documents',
      tasks: 'Tâches',
      settings: 'Paramètres',
  };
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbItems = pathSegments.map((segment, index) => {
      const url = `/${pathSegments.slice(0, index + 1).join('/')}`;
      const isLast = index === pathSegments.length - 1;
      const label = labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      return { label, url, isLast };
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Dynamic Breadcrumbs */}
        <div className="flex flex-col ml-0 lg:ml-2">
            <Breadcrumb className="hidden sm:block">
                <BreadcrumbList className="gap-1 sm:gap-1.5 min-h-[20px]">
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link href="/dashboard" className="text-xs">Accueil</Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    {breadcrumbItems.map((item, index) => (
                        <div key={item.url} className="flex items-center gap-1 sm:gap-1.5">
                            <BreadcrumbSeparator className="[&>svg]:size-3" />
                            <BreadcrumbItem>
                                {item.isLast ? (
                                    <BreadcrumbPage className="text-sm font-semibold">{item.label}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <Link href={item.url} className="text-sm">{item.label}</Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </div>
                    ))}
                </BreadcrumbList>
            </Breadcrumb>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Search / Command Palette */}
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex items-center gap-2 text-muted-foreground w-48 justify-start"
          onClick={() => {
            // Trigger Ctrl+K event to open command palette
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              ctrlKey: true,
              bubbles: true,
            });
            document.dispatchEvent(event);
          }}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            Ctrl+K
          </kbd>
        </Button>

        {/* Notifications */}
        <NotificationPopover />

        {/* Connected Workspace Users */}
        <div className="hidden sm:flex items-center mr-2">
            <TooltipProvider>
                <AvatarGroup>
                    {displayedMembers.map((m, index) => (
                        <Tooltip key={m.user_id}>
                            <TooltipTrigger asChild>
                                <Avatar 
                                    className="h-8 w-8 border-2 border-background relative cursor-pointer hover:!z-50 transition-transform hover:scale-110"
                                    style={{ zIndex: 40 - index }}
                                >
                                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                        {m.display_name?.charAt(0).toUpperCase() || m.username.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{m.display_name || m.username}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}

                    {hiddenMembers.length > 0 && (
                        <Popover>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <AvatarMore count={hiddenMembers.length} className="cursor-pointer transition-transform hover:scale-110 hover:z-50" />
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Voir les {hiddenMembers.length} autres membres</p>
                                </TooltipContent>
                            </Tooltip>
                            
                            <PopoverContent className="w-56 p-2" align="end">
                                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Autres membres du workspace</p>
                                <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto w-full">
                                    {hiddenMembers.map(m => (
                                        <div key={m.user_id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded-md cursor-pointer transition-colors">
                                            <Avatar className="h-7 w-7 flex-shrink-0">
                                                {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                                                    {m.display_name?.charAt(0).toUpperCase() || m.username.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium truncate">{m.display_name || m.username}</span>
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                </AvatarGroup>
            </TooltipProvider>
        </div>

        {/* Theme Toggle */}
        <div className="flex items-center gap-2">
          <Sun className={`h-4 w-4 transition-all duration-500 ${theme === 'light' ? 'text-amber-500 scale-125 rotate-0' : 'text-muted-foreground scale-75 -rotate-90'}`} />
          <Switch
            checked={mounted && theme === 'dark'}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            aria-label="Toggle dark mode"
          />
          <Moon className={`h-4 w-4 transition-all duration-500 ${theme === 'dark' ? 'text-indigo-400 scale-125 rotate-0' : 'text-muted-foreground scale-75 rotate-90'}`} />
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-8 w-8">
                {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={user.username} />}
                <AvatarFallback>
                  {getInitials(user?.display_name || user?.username)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline-block truncate max-w-[150px]">
                {user?.display_name || user?.username}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.display_name || user?.username}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {user?.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
