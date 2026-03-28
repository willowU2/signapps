'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore, useLabelsStore } from '@/lib/store';
import { useSidebarBadges } from '@/hooks/use-sidebar-badges';
import {
  LayoutDashboard,
  Container,
  HardDrive,
  Network,
  Settings,
  Users,
  Shield,
  Clock,
  Activity,
  Mic,
  Store,
  Archive,
  Plus,
  Tag,
  Brain,
  Upload,
  MessageSquare,
  Route,
  X,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Quick actions for "Nouveau" dropdown ──
const quickActions = [
  { icon: Container, label: 'Nouveau Container', href: '/containers', color: 'text-crm' },
  { icon: Route, label: 'Ajouter Route', href: '/routes', color: 'text-primary' },
  { icon: Upload, label: 'Upload Fichiers', href: '/storage', color: 'text-inventory' },
  { icon: MessageSquare, label: 'Chat IA', href: '/ai', color: 'text-ai-purple' },
  { icon: Archive, label: 'Nouveau Backup', href: '/backups', color: 'text-muted-foreground' },
];

// ── Nav items with optional badge keys ──
const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord', color: '', badgeKey: null },
  { href: '/containers', icon: Container, label: 'Containers', color: 'text-crm', badgeKey: 'containers' as const },
  { href: '/apps', icon: Store, label: 'App Store', color: 'text-inventory', badgeKey: null },
  { href: '/storage', icon: HardDrive, label: 'Drive', color: 'text-muted-foreground', badgeKey: 'storage' as const },
  { href: '/media', icon: Mic, label: 'Media', color: 'text-crm', badgeKey: null },
  { href: '/routes', icon: Network, label: 'Routes', color: 'text-primary', badgeKey: 'routes' as const },
  { href: '/vpn', icon: Shield, label: 'VPN', color: 'text-muted-foreground', badgeKey: null },
  { href: '/scheduler', icon: Clock, label: 'Scheduler', color: 'text-muted-foreground', badgeKey: null },
  { href: '/monitoring', icon: Activity, label: 'Monitoring', color: 'text-inventory', badgeKey: null },
  { href: '/backups', icon: Archive, label: 'Backups', color: 'text-muted-foreground', badgeKey: null },
  { href: '/ai', icon: Brain, label: 'Intelligence', color: 'text-ai-purple', badgeKey: null },
  { href: '/users', icon: Users, label: 'Users', color: 'text-crm', badgeKey: null },
  { href: '/settings', icon: Settings, label: 'Settings', color: 'text-muted-foreground', badgeKey: null },
];

// ── Color palette for labels ──
const labelColors = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#64748b', '#1a73e8',
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed } = useUIStore();
  const { labels, addLabel, removeLabel } = useLabelsStore();
  const { data: badges } = useSidebarBadges();

  const [nouveauOpen, setNouveauOpen] = useState(false);
  const [addLabelOpen, setAddLabelOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');

  const handleAddLabel = () => {
    if (!newLabelName.trim()) return;
    addLabel(newLabelName.trim(), newLabelColor);
    setNewLabelName('');
    setNewLabelColor('#3b82f6');
    setAddLabelOpen(false);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-full flex-col bg-sidebar py-4 transition-all duration-200',
          sidebarCollapsed ? 'w-16' : 'w-64 pr-4'
        )}
      >
        {/* ── Nouveau Button ── */}
        <div className={cn('mb-4', sidebarCollapsed ? 'px-2' : 'px-4')}>
          {sidebarCollapsed ? (
            <Popover open={nouveauOpen} onOpenChange={setNouveauOpen}>
              <PopoverTrigger asChild>
                <button className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-card google-shadow google-shadow-hover transition-all">
                  <Plus className="h-6 w-6 text-primary" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-52 p-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => { router.push(action.href); setNouveauOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <action.icon className={cn('h-4 w-4', action.color)} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          ) : (
            <Popover open={nouveauOpen} onOpenChange={setNouveauOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-3 rounded-2xl bg-card px-6 py-4 google-shadow google-shadow-hover transition-all text-sm font-medium text-foreground/80">
                  <Plus className="h-7 w-7 text-primary" />
                  Nouveau
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-56 p-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => { router.push(action.href); setNouveauOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                  >
                    <action.icon className={cn('h-4 w-4', action.color)} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            const badgeValue = item.badgeKey && badges ? badges[item.badgeKey] : undefined;

            const linkContent = (
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-4 py-2.5 text-sm font-medium transition-colors',
                  sidebarCollapsed
                    ? 'justify-center rounded-lg mx-2 px-2'
                    : 'rounded-r-full px-6',
                  isActive
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'text-sidebar-foreground hover:bg-muted'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-accent-foreground' : item.color || 'text-muted-foreground'
                  )}
                />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {badgeValue !== undefined && badgeValue > 0 && (
                      <span className="ml-auto text-xs font-semibold text-muted-foreground">
                        {badgeValue}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                    {badgeValue !== undefined && badgeValue > 0 && ` (${badgeValue})`}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}

          {/* ── Labels ── */}
          {!sidebarCollapsed && (
            <div className="mx-4 mt-4 border-t border-sidebar-border pt-4">
              <div className="mb-2 flex items-center justify-between px-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Labels
                </h3>
                <Popover open={addLabelOpen} onOpenChange={setAddLabelOpen}>
                  <PopoverTrigger asChild>
                    <button className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="right" className="w-56 space-y-3 p-3">
                    <p className="text-xs font-semibold">Nouveau label</p>
                    <Input
                      placeholder="Nom du label"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddLabel()}
                      className="h-8 text-xs"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {labelColors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewLabelColor(c)}
                          className={cn(
                            'h-5 w-5 rounded-full transition-all',
                            newLabelColor === c ? 'ring-2 ring-offset-2 ring-primary' : ''
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Button size="sm" className="w-full text-xs" onClick={handleAddLabel}>
                      Ajouter
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>

              {labels.map((label) => (
                <div
                  key={label.id}
                  className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-muted"
                >
                  <Tag className="h-4 w-4 shrink-0" style={{ color: label.color }} />
                  <span className="flex-1 truncate">{label.name}</span>
                  <button
                    onClick={() => removeLabel(label.id)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
