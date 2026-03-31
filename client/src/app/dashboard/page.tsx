'use client';

import { useEffect, useState } from 'react';
import { usePageTitle } from '@/hooks/use-page-title';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Pencil, Plus, RotateCcw, Printer } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardData } from '@/hooks/use-dashboard';
import { useDashboardStore, getDefaultLayout } from '@/stores/dashboard-store';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { AddWidgetDialog } from '@/components/dashboard/add-widget-dialog';
import { useAuthStore } from '@/lib/store';
import { resetAllBreakers } from '@/lib/circuit-breaker';
import { cn } from '@/lib/utils';

function getRoleLabel(role?: number): string {
  if (role === undefined) return 'Utilisateur';
  if (role >= 3) return 'Super Admin';
  if (role >= 2) return 'Admin';
  if (role >= 1) return 'Utilisateur';
  return 'Invité';
}

export default function DashboardPage() {
  usePageTitle('Tableau de bord');
  const queryClient = useQueryClient();
  const { isFetching: refreshing, isLoading: loading } = useDashboardData();
  const { editMode, setEditMode, resetLayout, widgets, setWidgets } = useDashboardStore();
  const { user } = useAuthStore();
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize layout based on role if first visit or empty layout
  useEffect(() => {
    if (initialized) return;
    if (user?.role !== undefined && widgets.length === 0) {
      const defaultLayout = getDefaultLayout(user.role);
      setWidgets(defaultLayout);
    }
    setInitialized(true);
  }, [user?.role, widgets.length, initialized, setWidgets]);

  const handlePrint = () => {
    const header = document.createElement('div');
    header.className = 'print-header';
    header.id = 'dashboard-print-header';
    header.innerHTML = `<h1>SignApps Platform — Tableau de bord</h1><p>${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`;
    header.style.display = 'none';
    const main = document.getElementById('main-content');
    if (main) main.prepend(header);
    window.print();
    setTimeout(() => {
      document.getElementById('dashboard-print-header')?.remove();
    }, 500);
  };

  if (loading && !initialized) {
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
      <div className="space-y-6">
        {/* Header */}
        <header className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Tableau de bord</h2>
            <p className="text-sm text-muted-foreground">
              Bienvenue, voici l&apos;état actuel de votre workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Role indicator */}
            <Badge variant="outline" className="text-xs">
              {getRoleLabel(user?.role)}
            </Badge>

            {editMode && (
              <>
                <Button variant="outline" size="sm" onClick={() => setAddWidgetOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter
                </Button>
                <Button variant="outline" size="sm" onClick={() => resetLayout(user?.role)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
                </Button>
              </>
            )}
            <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={() => setEditMode(!editMode)}>
              <Pencil className="mr-2 h-4 w-4" />{editMode ? 'Terminer' : 'Personnaliser'}
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => { resetAllBreakers(); queryClient.invalidateQueries({ queryKey: ['dashboard'] }); queryClient.invalidateQueries({ queryKey: ['service-health'] }); }}
              disabled={refreshing}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} /> Actualiser
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
              <Printer className="mr-2 h-4 w-4" /> Imprimer
            </Button>
          </div>
        </header>

        {/* Always render the widget grid — no more hardcoded non-edit mode */}
        <WidgetGrid />

        <AddWidgetDialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen} />
      </div>
    </AppLayout>
  );
}
