'use client';

/**
 * Calendar Settings Page
 *
 * Configure external calendar connections and sync settings.
 */

import React, { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Link2,
  RefreshCw,
  AlertCircle,
  Calendar,
  History,
  AlertTriangle,
} from 'lucide-react';
import { ProviderConnector } from '@/components/calendar/external-sync/provider-connector';
import { CalendarEventTriggers } from '@/components/workflow/calendar-event-triggers';
import { SyncConfigPanel } from '@/components/calendar/external-sync/sync-config-panel';
import { useExternalSyncStore, selectHasUnresolvedConflicts } from '@/stores/external-sync-store';
import { CategoryManager } from '@/components/calendar/category-colors';
import { PublicCalendarLink } from '@/components/calendar/public-calendar-link';
import { Palette, Globe } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';
import { AppLayout } from "@/components/layout/app-layout";

// ============================================================================
// Sync Logs Tab
// ============================================================================

function SyncLogsTab() {
  const { syncLogs, isLoadingLogs, loadSyncLogs } = useExternalSyncStore();

  useEffect(() => {
    loadSyncLogs();
  }, [loadSyncLogs]);

  if (syncLogs.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Aucun historique de synchronisation</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {syncLogs.map((log) => (
        <div
          key={log.id}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full ${
                log.status === 'success'
                  ? 'bg-green-500'
                  : log.status === 'partial'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            />
            <div>
              <p className="font-medium">
                {log.direction === 'import' ? 'Import' : 'Export'}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(log.started_at).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p>
              +{log.events_imported} / -{log.events_deleted} / ~{log.events_updated}
            </p>
            <p className="text-muted-foreground">{log.duration_ms}ms</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Conflicts Tab
// ============================================================================

function ConflictsTab() {
  const {
    conflicts,
    isLoadingConflicts,
    loadConflicts,
    resolveConflict,
    resolveAllConflicts,
  } = useExternalSyncStore();

  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  const unresolvedConflicts = conflicts.filter((c) => !c.resolved);

  if (unresolvedConflicts.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Aucun conflit à résoudre</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const configId = unresolvedConflicts[0]?.sync_config_id;
            if (configId) resolveAllConflicts(configId, 'local');
          }}
        >
          Garder tout en local
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const configId = unresolvedConflicts[0]?.sync_config_id;
            if (configId) resolveAllConflicts(configId, 'remote');
          }}
        >
          Garder tout en distant
        </Button>
      </div>

      {unresolvedConflicts.map((conflict) => (
        <div key={conflict.id} className="p-4 border rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                Conflit: {conflict.conflict_type}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(conflict.created_at).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-sm font-medium mb-1">Version locale</p>
              <p className="text-xs text-muted-foreground">
                Modifié: {new Date(conflict.local_updated_at).toLocaleString('fr-FR')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => resolveConflict(conflict.id, 'local')}
              >
                Garder local
              </Button>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <p className="text-sm font-medium mb-1">Version distante</p>
              <p className="text-xs text-muted-foreground">
                Modifié: {new Date(conflict.external_updated_at).toLocaleString('fr-FR')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => resolveConflict(conflict.id, 'remote')}
              >
                Garder distant
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function CalendarSettingsPage() {
  usePageTitle('Parametres calendrier');
  const { error, clearError, loadConnections } = useExternalSyncStore();
  const hasUnresolvedConflicts = useExternalSyncStore(selectHasUnresolvedConflicts);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  return (
    <AppLayout>
    <div className="w-full py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Paramètres du calendrier</h1>
        <p className="text-muted-foreground mt-2">
          Gérez vos connexions aux calendriers externes et configurez la synchronisation
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={clearError}
          >
            Fermer
          </Button>
        </Alert>
      )}

      <Tabs defaultValue="connections" className="w-full">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7">
          <TabsTrigger value="connections" className="flex gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Connexions</span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Synchronisation</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Historique</span>
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="flex gap-2 relative">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Conflits</span>
            {hasUnresolvedConflicts && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </TabsTrigger>
          {/* IDEA-050: Category colors */}
          <TabsTrigger value="categories" className="flex gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Catégories</span>
          </TabsTrigger>
          {/* IDEA-046: Public link */}
          <TabsTrigger value="sharing" className="flex gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Partage</span>
          </TabsTrigger>
          {/* IDEA-128: Calendar event triggers */}
          <TabsTrigger value="triggers" className="flex gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Déclencheurs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="mt-6">
          <ProviderConnector />
        </TabsContent>

        <TabsContent value="sync" className="mt-6">
          <SyncConfigPanel />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <SyncLogsTab />
        </TabsContent>

        <TabsContent value="conflicts" className="mt-6">
          <ConflictsTab />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <div className="max-w-lg">
            <CategoryManager />
          </div>
        </TabsContent>

        <TabsContent value="sharing" className="mt-6">
          <div className="max-w-lg space-y-4">
            <PublicCalendarLink calendarId="default" calendarName="My Calendar" />
          </div>
        </TabsContent>

        {/* IDEA-128: Calendar event triggers */}
        <TabsContent value="triggers" className="mt-6">
          <CalendarEventTriggers />
        </TabsContent>
      </Tabs>
    </div>
    </AppLayout>
  );
}
