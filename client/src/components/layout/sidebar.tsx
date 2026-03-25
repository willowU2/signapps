'use client';


import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/lib/store';
import { useEntityStore } from '@/stores/entity-hub-store';
import { FEATURES } from '@/lib/features';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { StreakCounter } from '@/components/streak-counter';
import { PomodoroTimer } from '@/components/pomodoro-timer';
import { usePermissions } from '@/lib/permissions';
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
  CalendarRange,
  CheckSquare,
  Video,
  Server,
  Terminal,
  MonitorSmartphone,
  FolderOpen,
  DoorOpen,
  Building2,
  TrendingUp,
  Layers,
  Globe,
  Lock,
  CreditCard,
  Bell,
  ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Navigation groups avec feature flags et permissions
 * Les items avec enabled: false sont cachés (règle NO DEAD ENDS)
 * Les groupes avec adminOnly: true ne sont visibles que pour les admins
 */
const navGroupsConfig = [
  {
    label: 'Productivity',
    icon: FileText,
    adminOnly: false,
    items: [
      { href: '/docs', icon: FileText, label: 'Docs', enabled: FEATURES.DOCS },
      { href: '/sheets', icon: Table, label: 'Sheets', enabled: FEATURES.DOCS },
      { href: '/slides', icon: Presentation, label: 'Slides', enabled: FEATURES.DOCS },
      { href: '/forms', icon: ClipboardList, label: 'Forms', enabled: FEATURES.IDENTITY },
      { href: '/mail', icon: Mail, label: 'Mail', enabled: FEATURES.MAIL },
      { href: '/cal', icon: Calendar, label: 'Calendar', enabled: FEATURES.CALENDAR },
      { href: '/tasks', icon: CheckSquare, label: 'Tasks', enabled: FEATURES.SCHEDULER },
      { href: '/resources', icon: DoorOpen, label: 'Resources', enabled: FEATURES.IDENTITY },
      { href: '/tools', icon: Layers, label: 'Tools', enabled: FEATURES.OFFICE },
    ]
  },
  {
    label: 'Communication',
    icon: MessagesSquare,
    adminOnly: false,
    items: [
      { href: '/chat', icon: MessagesSquare, label: 'Chat', enabled: FEATURES.COLLAB },
      { href: '/meet', icon: Video, label: 'Meet', enabled: FEATURES.MEET },
    ]
  },
  {
    label: 'Infrastructure',
    icon: HardDrive,
    adminOnly: true, // Admin only - containers et routes sont des fonctions admin
    items: [
      { href: '/containers', icon: Container, label: 'Containers', enabled: FEATURES.CONTAINERS },
      { href: '/drive', icon: HardDrive, label: 'Global Drive', enabled: FEATURES.STORAGE },
      { href: '/routes', icon: Network, label: 'Routes', enabled: FEATURES.PROXY },
      { href: '/proxy', icon: Globe, label: 'Proxy', enabled: FEATURES.PROXY },
      { href: '/securelink', icon: Lock, label: 'SecureLink', enabled: FEATURES.IDENTITY },
      { href: '/vpn', icon: Shield, label: 'VPN', enabled: FEATURES.VPN },
      { href: '/backups', icon: Archive, label: 'Backups', enabled: FEATURES.CONTAINERS },
    ]
  },
  {
    label: 'IT Management',
    icon: Server,
    adminOnly: true, // Admin only
    items: [
      { href: '/apps', icon: Store, label: 'App Store', enabled: FEATURES.CONTAINERS },
      // Services skeleton - CACHÉS (NO DEAD ENDS)
      { href: '/it-assets', icon: Server, label: 'IT Assets', enabled: FEATURES.IT_ASSETS },
      { href: '/pxe', icon: Terminal, label: 'PXE Deploy', enabled: FEATURES.PXE },
      { href: '/remote', icon: MonitorSmartphone, label: 'Remote Access', enabled: FEATURES.REMOTE },
    ]
  },
  {
    label: 'Operations',
    icon: Activity,
    adminOnly: true, // Admin only - scheduler et monitoring
    items: [
      { href: '/ai', icon: MessageSquare, label: 'AI', enabled: FEATURES.AI },
      { href: '/media', icon: Mic, label: 'Media', enabled: FEATURES.MEDIA },
      { href: '/scheduler', icon: Clock, label: 'Scheduler', enabled: FEATURES.SCHEDULER },
      { href: '/analytics', icon: TrendingUp, label: 'Analytics', enabled: FEATURES.METRICS },
      { href: '/monitoring', icon: Activity, label: 'Monitoring', enabled: FEATURES.METRICS },
    ]
  },
  {
    label: 'Administration',
    icon: ShieldCheck,
    adminOnly: true, // Admin only - section administration
    items: [
      { href: '/admin', icon: ShieldCheck, label: 'Admin', enabled: FEATURES.IDENTITY },
      { href: '/admin/users', icon: Users, label: 'Users', enabled: FEATURES.IDENTITY },
      { href: '/admin/workspaces', icon: Building2, label: 'Workspaces', enabled: FEATURES.IDENTITY },
      { href: '/admin/resources', icon: DoorOpen, label: 'Resources', enabled: FEATURES.IDENTITY },
      { href: '/admin/storage', icon: HardDrive, label: 'Storage Config', enabled: FEATURES.STORAGE },
      { href: '/billing', icon: CreditCard, label: 'Billing', enabled: true },
      { href: '/notifications', icon: Bell, label: 'Notifications', enabled: true },
      { href: '/settings', icon: Settings, label: 'Settings', enabled: true },
    ]
  }
];

/**
 * Filtre les groupes de navigation selon les features et les permissions
 */
function filterNavGroups(isUserAdmin: boolean) {
  return navGroupsConfig
    .filter(group => !group.adminOnly || isUserAdmin) // Filter by admin permission
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.enabled)
    }))
    .filter(group => group.items.length > 0);
}

const isItemActive = (href: string, pathname: string) => {
  if (href === '/admin' && pathname !== '/admin') return false;
  return pathname.startsWith(href);
};

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { workspaces, selectedWorkspaceId, setSelectedWorkspace, fetchWorkspaces, projects, fetchProjects } = useEntityStore();
  const { isAdmin } = usePermissions();

  // Filtrer les groupes de navigation selon les permissions utilisateur
  const navGroups = useMemo(() => filterNavGroups(isAdmin()), [isAdmin]);

  const findActiveGroupIndex = () => {
    const index = navGroups.findIndex(g => g.items.some(item => isItemActive(item.href, pathname)));
    return index !== -1 ? index : 0;
  };

  const [expandedGroup, setExpandedGroup] = useState<number>(findActiveGroupIndex());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchWorkspaces();
    fetchProjects();
  }, [fetchWorkspaces, fetchProjects]);

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
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/10 dark:border-white/5 bg-sidebar/80 backdrop-blur-2xl shadow-glass transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo and Workspace Switcher */}
        <div className="flex flex-col border-b p-3 shrink-0">
          <div className="flex h-10 items-center justify-between mb-2">
            {!isCollapsed && (
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm ring-1 ring-primary/20">
                  <span className="text-lg font-bold text-primary-foreground">S</span>
                </div>
                <span className="text-lg font-bold tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">SignApps</span>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!isCollapsed)}
              className={cn(isCollapsed && 'mx-auto h-8 w-8')}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {!isCollapsed && (
             <div className="relative mt-1">
               <select 
                 className="w-full bg-sidebar-accent/50 border border-sidebar-border text-sidebar-foreground text-sm rounded-md py-1.5 px-2 focus:ring-1 focus:ring-primary appearance-none outline-none"
                 value={selectedWorkspaceId || ""}
                 onChange={(e) => setSelectedWorkspace(e.target.value)}
                 title="Switch Workspace"
               >
                 {workspaces.length === 0 ? (
                   <option disabled value="">No Workspaces</option>
                 ) : (
                   workspaces.map(w => (
                     <option key={w.id} value={w.id}>{w.name}</option>
                   ))
                 )}
               </select>
               <ChevronDown className="absolute right-2 top-2.5 h-3 w-3 text-muted-foreground pointer-events-none" />
             </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 p-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {isCollapsed ? (
            <Tooltip key="Dashboard">
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard"
                  className={cn(
                    'relative flex w-full items-center justify-center rounded-lg p-2.5 transition-colors mb-2 group',
                    pathname === '/dashboard'
                      ? 'text-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  {pathname === '/dashboard' && (
                    <motion.div
                      layoutId="sidebar-active-collapsed"
                      className="absolute inset-0 bg-primary rounded-lg shadow-sm"
                      initial={false}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <LayoutDashboard className="relative z-10 h-5 w-5 transition-transform group-hover:scale-110" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-semibold glass shadow-glass">
                Dashboard
              </TooltipContent>
            </Tooltip>
          ) : (
             <Link
              href="/dashboard"
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold transition-colors mb-2',
                pathname === '/dashboard'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground'
              )}
            >
              {pathname === '/dashboard' && (
                  <motion.div
                    layoutId="sidebar-active-item"
                    className="absolute inset-0 bg-primary/10 rounded-lg shadow-sm ring-1 ring-primary/20"
                    initial={false}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
              )}
              <div className="relative z-10 flex items-center gap-3 w-full">
                <LayoutDashboard className={cn("h-5 w-5 transition-transform group-hover:scale-110", pathname === '/dashboard' && "text-primary")} />
                <span>Dashboard</span>
              </div>
            </Link>
          )}

          {/* Dynamic Projects Injection */}
          {!isCollapsed && projects.length > 0 && (
            <div className="mb-2 space-y-1">
              <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Projects
              </div>
              {projects.map(project => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{project.name}</span>
                </Link>
              ))}
            </div>
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
                        'relative flex w-full items-center justify-center rounded-lg p-2.5 transition-colors group',
                        isGroupActive
                          ? 'text-primary'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      )}
                    >
                      {isGroupActive && (
                        <motion.div
                          layoutId="sidebar-active-collapsed"
                          className="absolute inset-0 bg-primary/10 ring-1 ring-primary/20 rounded-lg shadow-sm"
                          initial={false}
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <DisplayIcon className="relative z-10 h-5 w-5 transition-transform group-hover:scale-110" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-semibold glass shadow-glass">
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
                    'group flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-semibold transition-all duration-200',
                    isExpanded
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isExpanded && "text-primary/80")} />
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
                              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ml-4 border-l-2',
                              isActive
                                ? 'border-primary text-primary'
                                : 'border-transparent text-sidebar-foreground hover:border-sidebar-foreground/30 hover:bg-sidebar-accent/40'
                            )}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="sidebar-active-item"
                                className="absolute inset-0 bg-primary/5 rounded-r-lg shadow-sm"
                                initial={false}
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                              />
                            )}
                            <div className="relative z-10 flex items-center gap-3 w-full">
                              <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                              <span>{item.label}</span>
                            </div>
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
        <div className="border-t p-2 shrink-0 flex items-center justify-center gap-2">
          <ThemeToggle />
          {!isCollapsed && (
            <>
              <StreakCounter />
              <PomodoroTimer />
              <p className="text-xs text-muted-foreground">
                SignApps v0.1.0
              </p>
            </>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}


