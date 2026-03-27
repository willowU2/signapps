'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardData } from '@/hooks/use-dashboard';
import { useDashboardEditMode, useDashboardEditActions } from '@/stores/dashboard-store';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { AddWidgetSheet } from '@/components/dashboard/add-widget-sheet';
import { CardGridSkeleton } from '@/components/ui/skeleton-loader';
import { ActivityFeed } from '@/components/crosslinks/ActivityFeed';
import { ActivityHeatmap } from '@/components/activity-heatmap';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { isLoading: loading, isFetching: refreshing } = useDashboardData();
  // Granular selectors for optimized re-renders
  const editMode = useDashboardEditMode();
  const { setEditMode, resetLayout } = useDashboardEditActions();
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mb-8">Welcome back. Here's an overview of your systems.</p>
          <CardGridSkeleton count={4} />
          <Skeleton className="h-48 w-full rounded-2xl mt-4" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/50">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Welcome back. Here's an overview of your systems.</p>
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
          </div>
        </div>

        <WidgetGrid />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
          <div className="xl:col-span-2 border rounded-xl p-4 bg-card">
            <h2 className="text-base font-semibold mb-3">Activité récente</h2>
            <ActivityFeed limit={20} />
          </div>
          <div className="border rounded-xl p-4 bg-card">
            <h2 className="text-base font-semibold mb-3">Heatmap d'activité</h2>
            <ActivityHeatmap data={[]} label="Cette semaine" />
          </div>
        </div>

        <AddWidgetSheet open={addWidgetOpen} onOpenChange={setAddWidgetOpen} />
      </div>
    </AppLayout>
  );
}
