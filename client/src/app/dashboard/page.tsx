'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Pencil, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardData } from '@/hooks/use-dashboard';
import { useDashboardStore } from '@/stores/dashboard-store';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { AddWidgetDialog } from '@/components/dashboard/add-widget-dialog';
import { AiDailyBrief } from '@/components/dashboard/ai-daily-brief';
import { UnifiedStats } from '@/components/dashboard/unified-stats';
import { RecentFiles } from '@/components/dashboard/recent-files';
import { GlobalActivityFeed as ActivityFeed } from '@/components/crosslinks/GlobalActivityFeed';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading: loading, isFetching: refreshing } = useDashboardData();
  const { editMode, setEditMode, resetLayout } = useDashboardStore();
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 rounded-2xl" />
          <div className="grid gap-6 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddWidgetOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Widget
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetLayout}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </>
            )}
            <Button
              variant={editMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditMode(!editMode)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editMode ? 'Done' : 'Edit'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                queryClient.invalidateQueries({ queryKey: ['service-health'] });
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Personnaliser
            </Button>
          </div>
        </header>

        {/* Unified view (default) */}
        {!editMode && (
          <>
            {/* AI Daily Brief */}
            <AiDailyBrief data={data} />

            {/* 3 Stat Cards */}
            <UnifiedStats data={data} />

            {/* 2 columns: Recent Files + Activity Feed */}
            <div className="grid grid-cols-1 gap-8 pb-12 lg:grid-cols-2">
              <RecentFiles />
              <ActivityFeed />
            </div>
          </>
        )}

        {/* Widget grid (edit mode) */}
        {editMode && <WidgetGrid />}

        <AddWidgetDialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen} />
      </div>
    </AppLayout>
  );
}
