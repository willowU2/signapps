'use client';

/**
 * SyncConfigPanel Component
 *
 * Panel for configuring sync settings between local and external calendars.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Settings2,
  Trash2,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Pause,
} from 'lucide-react';
import { useExternalSyncStore } from '@/stores/external-sync-store';
import { useCalendarStore } from '@/stores/calendar-store';
import type {
  SyncConfig,
  SyncDirection,
  ConflictResolution,
  ExternalCalendar,
  ProviderConnection,
} from '@/lib/calendar/external-sync/types';
import {
  SYNC_DIRECTION_LABELS,
  CONFLICT_RESOLUTION_LABELS,
  PROVIDER_LABELS,
} from '@/lib/calendar/external-sync/types';

// ============================================================================
// Direction Icon
// ============================================================================

function DirectionIcon({ direction }: { direction: SyncDirection }) {
  switch (direction) {
    case 'import':
      return <ArrowLeft className="h-4 w-4" />;
    case 'export':
      return <ArrowRight className="h-4 w-4" />;
    case 'bidirectional':
      return <ArrowLeftRight className="h-4 w-4" />;
  }
}

// ============================================================================
// Sync Config Item
// ============================================================================

interface SyncConfigItemProps {
  config: SyncConfig;
  externalCalendar?: ExternalCalendar;
  connection?: ProviderConnection;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  onSync: () => void;
  isSyncing: boolean;
}

function SyncConfigItem({
  config,
  externalCalendar,
  connection,
  onEdit,
  onDelete,
  onToggle,
  onSync,
  isSyncing,
}: SyncConfigItemProps) {
  const localCalendars = useCalendarStore((state) => state.calendars);
  const localCalendar = localCalendars.find((c) => c.id === config.local_calendar_id);

  return (
    <Card className={!config.is_enabled ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Status indicator */}
            <div
              className={`w-3 h-3 rounded-full ${
                config.is_enabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />

            {/* Calendars */}
            <div className="flex items-center gap-2">
              <div>
                <p className="font-medium">{localCalendar?.name || 'Calendrier local'}</p>
                <p className="text-xs text-muted-foreground">Local</p>
              </div>

              <DirectionIcon direction={config.direction} />

              <div>
                <p className="font-medium">
                  {externalCalendar?.name || 'Calendrier externe'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connection ? PROVIDER_LABELS[connection.provider] : 'Externe'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {SYNC_DIRECTION_LABELS[config.direction]}
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              onClick={onSync}
              disabled={!config.is_enabled || isSyncing}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggle(!config.is_enabled)}
            >
              {config.is_enabled ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Settings2 className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sync info */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Sync every {config.sync_interval_minutes} min
          </span>
          <span>
            -{config.sync_past_days}d / +{config.sync_future_days}d
          </span>
          <span>
            Conflits: {CONFLICT_RESOLUTION_LABELS[config.conflict_resolution]}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Create/Edit Sync Config Dialog
// ============================================================================

interface SyncConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: SyncConfig;
  connections: ProviderConnection[];
  externalCalendars: Record<string, ExternalCalendar[]>;
  onSave: (config: Partial<SyncConfig>) => void;
}

function SyncConfigDialog({
  open,
  onOpenChange,
  config,
  connections,
  externalCalendars,
  onSave,
}: SyncConfigDialogProps) {
  const localCalendars = useCalendarStore((state) => state.calendars);

  const [localCalendarId, setLocalCalendarId] = useState(config?.local_calendar_id || '');
  const [connectionId, setConnectionId] = useState(config?.connection_id || '');
  const [externalCalendarId, setExternalCalendarId] = useState(config?.external_calendar_id || '');
  const [direction, setDirection] = useState<SyncDirection>(config?.direction || 'bidirectional');
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>(
    config?.conflict_resolution || 'newest_wins'
  );
  const [syncPastDays, setSyncPastDays] = useState(config?.sync_past_days || 30);
  const [syncFutureDays, setSyncFutureDays] = useState(config?.sync_future_days || 365);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(config?.sync_interval_minutes || 15);
  const [syncDeletions, setSyncDeletions] = useState(config?.sync_deletions ?? true);
  const [syncAttendees, setSyncAttendees] = useState(config?.sync_attendees ?? true);
  const [syncReminders, setSyncReminders] = useState(config?.sync_reminders ?? true);

  const selectedExternalCalendars = connectionId ? externalCalendars[connectionId] || [] : [];

  const handleSave = () => {
    onSave({
      local_calendar_id: localCalendarId,
      connection_id: connectionId,
      external_calendar_id: externalCalendarId,
      direction,
      conflict_resolution: conflictResolution,
      sync_past_days: syncPastDays,
      sync_future_days: syncFutureDays,
      sync_interval_minutes: syncIntervalMinutes,
      sync_deletions: syncDeletions,
      sync_attendees: syncAttendees,
      sync_reminders: syncReminders,
    });
    onOpenChange(false);
  };

  const isValid = localCalendarId && connectionId && externalCalendarId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {config ? 'Modifier la synchronisation' : 'Nouvelle synchronisation'}
          </DialogTitle>
          <DialogDescription>
            Configurez la synchronisation entre vos calendriers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Calendar Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Calendrier local</Label>
              <Select value={localCalendarId} onValueChange={setLocalCalendarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {localCalendars.map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      {cal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Compte externe</Label>
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {connections.filter((c) => c.is_connected).map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.account_email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {connectionId && (
            <div className="space-y-2">
              <Label>Calendrier externe</Label>
              <Select value={externalCalendarId} onValueChange={setExternalCalendarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedExternalCalendars.map((cal) => (
                    <SelectItem key={cal.id} value={cal.external_id}>
                      {cal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Direction */}
          <div className="space-y-2">
            <Label>Direction de synchronisation</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as SyncDirection)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bidirectional">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    Bidirectionnel (recommandé)
                  </div>
                </SelectItem>
                <SelectItem value="import">
                  <div className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Import seulement
                  </div>
                </SelectItem>
                <SelectItem value="export">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Export seulement
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conflict Resolution */}
          <div className="space-y-2">
            <Label>Résolution des conflits</Label>
            <Select
              value={conflictResolution}
              onValueChange={(v) => setConflictResolution(v as ConflictResolution)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONFLICT_RESOLUTION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Sync Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Synchroniser les suppressions</Label>
                <p className="text-xs text-muted-foreground">
                  Supprimer les événements quand ils sont supprimés de l'autre côté
                </p>
              </div>
              <Switch checked={syncDeletions} onCheckedChange={setSyncDeletions} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Synchroniser les participants</Label>
                <p className="text-xs text-muted-foreground">
                  Inclure la liste des participants
                </p>
              </div>
              <Switch checked={syncAttendees} onCheckedChange={setSyncAttendees} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Synchroniser les rappels</Label>
                <p className="text-xs text-muted-foreground">
                  Inclure les notifications de rappel
                </p>
              </div>
              <Switch checked={syncReminders} onCheckedChange={setSyncReminders} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {config ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface SyncConfigPanelProps {
  className?: string;
}

export function SyncConfigPanel({ className }: SyncConfigPanelProps) {
  const {
    connections,
    externalCalendars,
    syncConfigs,
    isSyncing,
    isLoadingConfigs,
    loadSyncConfigs,
    loadExternalCalendars,
    createSyncConfig,
    updateSyncConfig,
    deleteSyncConfig,
    toggleSyncConfig,
    triggerSync,
    triggerSyncAll,
  } = useExternalSyncStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SyncConfig | undefined>();
  const [syncingConfigId, setSyncingConfigId] = useState<string | null>(null);

  useEffect(() => {
    loadSyncConfigs();
    // Load external calendars for all connections
    connections.forEach((conn) => {
      if (conn.is_connected) {
        loadExternalCalendars(conn.id);
      }
    });
  }, [loadSyncConfigs, loadExternalCalendars, connections]);

  const handleCreate = () => {
    setEditingConfig(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (config: SyncConfig) => {
    setEditingConfig(config);
    setDialogOpen(true);
  };

  const handleSave = async (configData: Partial<SyncConfig>) => {
    if (editingConfig) {
      await updateSyncConfig(editingConfig.id, configData);
    } else {
      await createSyncConfig(configData as any);
    }
    setDialogOpen(false);
  };

  const handleSync = async (configId: string) => {
    setSyncingConfigId(configId);
    await triggerSync(configId);
    setSyncingConfigId(null);
  };

  const getExternalCalendar = (connectionId: string, externalId: string) =>
    externalCalendars[connectionId]?.find((c) => c.external_id === externalId);

  const getConnection = (connectionId: string) =>
    connections.find((c) => c.id === connectionId);

  const connectedCount = connections.filter((c) => c.is_connected).length;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Configurations de synchronisation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {syncConfigs.length} configuration(s) active(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => triggerSyncAll()}
            disabled={isSyncing || syncConfigs.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Tout synchroniser
          </Button>
          <Button onClick={handleCreate} disabled={connectedCount === 0}>
            Nouvelle synchronisation
          </Button>
        </div>
      </div>

      {isLoadingConfigs ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : syncConfigs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowLeftRight className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Aucune synchronisation configurée</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {connectedCount === 0
                ? 'Connectez d\'abord un calendrier externe ci-dessus.'
                : 'Créez une nouvelle synchronisation pour commencer.'}
            </p>
            {connectedCount > 0 && (
              <Button onClick={handleCreate}>Créer une synchronisation</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {syncConfigs.map((config) => (
            <SyncConfigItem
              key={config.id}
              config={config}
              externalCalendar={getExternalCalendar(config.connection_id, config.external_calendar_id)}
              connection={getConnection(config.connection_id)}
              onEdit={() => handleEdit(config)}
              onDelete={() => deleteSyncConfig(config.id)}
              onToggle={(enabled) => toggleSyncConfig(config.id, enabled)}
              onSync={() => handleSync(config.id)}
              isSyncing={syncingConfigId === config.id}
            />
          ))}
        </div>
      )}

      <SyncConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        config={editingConfig}
        connections={connections}
        externalCalendars={externalCalendars}
        onSave={handleSave}
      />
    </div>
  );
}

export default SyncConfigPanel;
