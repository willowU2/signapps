'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardData } from '@/hooks/use-dashboard';
import { useDashboardStore } from '@/stores/dashboard-store';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { AddWidgetDialog } from '@/components/dashboard/add-widget-dialog';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { isLoading: loading, isFetching: refreshing } = useDashboardData();
  const { editMode, setEditMode, resetLayout } = useDashboardStore();
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
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

        <AddWidgetDialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen} />
      </div>
    </AppLayout>
  );
}
