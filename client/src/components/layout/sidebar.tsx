'use client';


import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Container,
  HardDrive,
  Network,
  MessageSquare,
  MessagesSquare,
  Mail,
  Table,
  Presentation,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  Shield,
  ShieldCheck,
  Clock,
  Activity,
  Mic,
  FileText,
  Store,
  Archive,
  Calendar,
  CheckSquare,
  Video,
  Server,
  Terminal,
  MonitorSmartphone,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navGroups = [
  {
    label: 'Productivity',
    icon: FileText,
    items: [
      { href: '/docs', icon: FileText, label: 'Docs' },
      { href: '/sheets', icon: Table, label: 'Sheets' },
      { href: '/slides', icon: Presentation, label: 'Slides' },
      { href: '/mail', icon: Mail, label: 'Mail' },
      { href: '/calendar', icon: Calendar, label: 'Calendar' },
      { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
    ]
  },
  {
    label: 'Communication',
    icon: MessagesSquare,
    items: [
      { href: '/chat', icon: MessagesSquare, label: 'Chat' },
      { href: '/meet', icon: Video, label: 'Meet' },

    ]
  },
  {
    label: 'Infrastructure',
    icon: HardDrive,
    items: [
      { href: '/containers', icon: Container, label: 'Containers' },
      { href: '/drive', icon: HardDrive, label: 'Global Drive' },
      { href: '/routes', icon: Network, label: 'Routes' },
      { href: '/vpn', icon: Shield, label: 'VPN' },
      { href: '/backups', icon: Archive, label: 'Backups' },
    ]
  },
  {
    label: 'IT Management',
    icon: Server,
    items: [
      { href: '/apps', icon: Store, label: 'App Store' },
      { href: '/it-assets', icon: Server, label: 'IT Assets' },
      { href: '/pxe', icon: Terminal, label: 'PXE Deploy' },
      { href: '/remote', icon: MonitorSmartphone, label: 'Remote Access' },
    ]
  },
  {
    label: 'Operations',
    icon: Activity,
    items: [
      { href: '/ai', icon: MessageSquare, label: 'AI' },
      { href: '/scheduler', icon: Clock, label: 'Scheduler' },
      { href: '/monitoring', icon: Activity, label: 'Monitoring' },
    ]
  },
  {
    label: 'Administration',
    icon: ShieldCheck,
    items: [
      { href: '/admin', icon: ShieldCheck, label: 'Admin' },
      { href: '/admin/users', icon: Users, label: 'Users' },
      { href: '/admin/storage', icon: HardDrive, label: 'Storage Config' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ]
  }
];

const isItemActive = (href: string, pathname: string) => {
  if (href === '/admin' && pathname !== '/admin') return false;
  return pathname.startsWith(href);
};

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();

  const findActiveGroupIndex = () => {
    const index = navGroups.findIndex(g => g.items.some(item => isItemActive(item.href, pathname)));
    return index !== -1 ? index : 0;
  };

  const [expandedGroup, setExpandedGroup] = useState<number>(findActiveGroupIndex());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !sidebarCollapsed) {
      const activeIdx = findActiveGroupIndex();
      if (activeIdx !== -1) {
        setExpandedGroup(activeIdx);
      }
    }
  }, [pathname, sidebarCollapsed, mounted]); // Update expansion when route changes

  const toggleGroup = (index: number) => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setExpandedGroup(index);
    } else {
      setExpandedGroup(expandedGroup === index ? -1 : index);
    }
  };

  const isCollapsed = mounted ? sidebarCollapsed : false;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-sidebar transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4 shrink-0">
          {!isCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">S</span>
              </div>
              <span className="text-lg font-semibold">SignApps</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!isCollapsed)}
            className={cn(isCollapsed && 'mx-auto')}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 p-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {isCollapsed ? (
            <Tooltip key="Dashboard">
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className={cn(
                    'flex w-full items-center justify-center rounded-lg p-2.5 transition-colors mb-2',
                    pathname === '/dashboard'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <LayoutDashboard className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-semibold">
                Dashboard
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/dashboard"
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold transition-colors mb-2',
                pathname === '/dashboard'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
              )}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
          )}

          {navGroups.map((group, groupIndex) => {
            const isGroupActive = group.items.some(item => isItemActive(item.href, pathname));
            const isExpanded = expandedGroup === groupIndex;

            if (isCollapsed) {
              const activeItemInGroup = group.items.find(item => isItemActive(item.href, pathname));
              const DisplayIcon = activeItemInGroup ? activeItemInGroup.icon : group.icon;

              return (
                <Tooltip key={group.label}>
                  <TooltipTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleGroup(groupIndex)}
                      className={cn(
                        'flex w-full items-center justify-center rounded-lg p-2.5 transition-colors',
                        isGroupActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <DisplayIcon className="h-5 w-5" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-semibold">
                    {group.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <div key={group.label} className="space-y-1">
                <button
                  onClick={() => toggleGroup(groupIndex)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold transition-colors',
                    isExpanded
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="h-4 w-4" />
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      isExpanded ? "rotate-180" : ""
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="submenu"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-1"
                    >
                      {group.items.map((item) => {
                        const isActive = isItemActive(item.href, pathname);
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ml-4 border-l-2',
                              isActive
                                ? 'border-primary bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                                : 'border-transparent text-sidebar-foreground hover:border-sidebar-foreground/30 hover:bg-sidebar-accent/50'
                            )}
                          >
                            <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4 shrink-0">
          {!isCollapsed && (
            <p className="text-xs text-muted-foreground">
              SignApps Platform v0.1.0
            </p>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
