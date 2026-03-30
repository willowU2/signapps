'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '@/hooks/use-page-title';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Pencil, Plus, RotateCcw, SlidersHorizontal, Search, ChevronDown, ChevronUp, Pin, FileText, Mail, CalendarDays, Printer } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { logActivity } from '@/hooks/use-activity-tracker';
import { useDashboardData } from '@/hooks/use-dashboard';
import { useDashboardStore } from '@/stores/dashboard-store';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { AddWidgetSheet as AddWidgetDialog } from '@/components/dashboard/add-widget-sheet';
import { AiDailyBrief } from '@/components/dashboard/ai-daily-brief';
import { UnifiedStats } from '@/components/dashboard/unified-stats';
import { RecentFiles } from '@/components/dashboard/recent-files';
import { GlobalActivityFeed as ActivityFeed } from '@/components/crosslinks/GlobalActivityFeed';
import { UpcomingEventsCard } from '@/components/dashboard/upcoming-events-card';
import { TodayView } from '@/components/interop/TodayView';
import { APP_REGISTRY, APP_CATEGORIES, type AppEntry } from '@/lib/app-registry';
import { usePinnedAppsStore } from '@/lib/store';
import { resetAllBreakers } from '@/lib/circuit-breaker';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';

// Render a lucide icon by name string
function AppIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }> | undefined>)[name];
  if (!Icon) return <LucideIcons.Grid className={className} />;
  return <Icon className={className} />;
}

function AppCard({ app, onDragStart }: { app: AppEntry; onDragStart: (e: React.DragEvent, app: AppEntry) => void }) {
  const router = useRouter();
  const { pinApp, pinnedApps } = usePinnedAppsStore();
  const isPinned = pinnedApps.some((p) => p.href === app.href);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, app)}
      onClick={() => router.push(app.href)}
      className="group relative flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0"
      title={`Glisser pour épingler dans la barre latérale`}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted', app.color)}>
          <AppIcon name={app.icon} className="h-4 w-4" />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); pinApp({ href: app.href, icon: app.icon, label: app.label, color: app.color }); }}
          className={cn(
            'shrink-0 rounded p-1 text-muted-foreground transition-all',
            isPinned
              ? 'text-primary opacity-100'
              : 'opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100'
          )}
          title={isPinned ? 'Déjà épinglé' : 'Épingler dans la barre'}
        >
          <Pin className="h-3 w-3" />
        </button>
      </div>
      <div>
        <p className="text-sm font-medium leading-tight">{app.label}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{app.description}</p>
      </div>
    </div>
  );
}

function CategorySection({ category, apps, onDragStart }: {
  category: string;
  apps: AppEntry[];
  onDragStart: (e: React.DragEvent, app: AppEntry) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</h3>
        <span className="text-xs text-muted-foreground/60">({apps.length})</span>
        <div className="ml-auto text-muted-foreground/60">
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </div>
      </button>
      {!collapsed && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} onDragStart={onDragStart} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DashboardPage() {
  usePageTitle('Tableau de bord');
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data, isLoading: loading, isFetching: refreshing } = useDashboardData();
  const { editMode, setEditMode, resetLayout } = useDashboardStore();
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [showApps, setShowApps] = useState(true);
  const [search, setSearch] = useState('');

  const handlePrint = () => {
    // Inject print header for dashboard
    const header = document.createElement('div');
    header.className = 'print-header';
    header.id = 'dashboard-print-header';
    header.innerHTML = `<h1>SignApps Platform — Tableau de bord</h1><p>${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`;
    header.style.display = 'none';
    const main = document.getElementById('main-content');
    if (main) main.prepend(header);
    window.print();
    // Cleanup after print
    setTimeout(() => {
      document.getElementById('dashboard-print-header')?.remove();
    }, 500);
  };

  const handleDragStart = (e: React.DragEvent, app: AppEntry) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      href: app.href, icon: app.icon, label: app.label, color: app.color,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredBySearch = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return APP_REGISTRY.filter(
      (a) => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [search]);

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 rounded-2xl" />
          <div className="grid gap-6 md:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <header className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Unified Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Bienvenue, voici l&apos;état actuel de votre workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editMode && (
              <>
                <Button variant="outline" size="sm" onClick={() => setAddWidgetOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Widget
                </Button>
                <Button variant="outline" size="sm" onClick={resetLayout}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset
                </Button>
              </>
            )}
            <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={() => setEditMode(!editMode)}>
              <Pencil className="mr-2 h-4 w-4" />{editMode ? 'Done' : 'Edit'}
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => { resetAllBreakers(); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); queryClient.invalidateQueries({ queryKey: ['service-health'] }); }}
              disabled={refreshing}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setEditMode(true); setAddWidgetOpen(true); }}>
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Personnaliser
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
              <Printer className="mr-2 h-4 w-4" /> Imprimer
            </Button>
          </div>
        </header>

        {/* Unified view (default) */}
        {!editMode && (
          <>
            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { logActivity('created', 'Nouveau document', 'Via dashboard'); router.push('/docs'); }}>
                <FileText className="mr-2 h-4 w-4 text-blue-500" /> Nouveau document
              </Button>
              <Button variant="outline" size="sm" onClick={() => { logActivity('created', 'Nouvel email', 'Via dashboard'); router.push('/mail'); }}>
                <Mail className="mr-2 h-4 w-4 text-amber-500" /> Nouveau mail
              </Button>
              <Button variant="outline" size="sm" onClick={() => { logActivity('created', 'Nouvelle reunion', 'Via dashboard'); router.push('/cal'); }}>
                <CalendarDays className="mr-2 h-4 w-4 text-green-500" /> Nouvelle reunion
              </Button>
            </div>

            <AiDailyBrief data={data} />
            <UnifiedStats data={data} />

            {/* Feature 30: Unified Today view (emails + tasks + events) */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <TodayView maxItems={15} />
            </div>

            {/* Upcoming Events */}
            <UpcomingEventsCard />

            {/* All Apps toggle */}
            <div>
              <button
                onClick={() => setShowApps(!showApps)}
                className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground"
              >
                {showApps ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Toutes les applications ({APP_REGISTRY.length})
                <span className="ml-1 text-xs font-normal text-muted-foreground">— glisser sur la barre latérale pour épingler</span>
              </button>

              {showApps && (
                <div className="space-y-6 rounded-2xl border border-border bg-card/50 p-6">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher une application..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Search results */}
                  {filteredBySearch ? (
                    filteredBySearch.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">Aucune application trouvée</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {filteredBySearch.map((app) => (
                          <AppCard key={app.id} app={app} onDragStart={handleDragStart} />
                        ))}
                      </div>
                    )
                  ) : (
                    /* Category sections */
                    APP_CATEGORIES.map((cat) => {
                      const apps = APP_REGISTRY.filter((a) => a.category === cat);
                      return <CategorySection key={cat} category={cat} apps={apps} onDragStart={handleDragStart} />;
                    })
                  )}
                </div>
              )}
            </div>

            {/* 2 columns: Recent Files + Activity Feed */}
            <div className="grid grid-cols-1 gap-8 pb-12 lg:grid-cols-2">
              <RecentFiles />
              <ActivityFeed />
            </div>
          </>
        )}

        {editMode && <WidgetGrid />}

        <AddWidgetDialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen} />
      </div>
    </AppLayout>
  );
}
