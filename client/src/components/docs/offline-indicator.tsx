'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CloudOff } from 'lucide-react';
import { usePresenceStore } from '@/stores/presence-store';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

/**
 * OfflineIndicator: displays connection/sync status in the editor header area.
 *
 * States:
 * - Connecté (green dot) — WebSocket active, document synced
 * - Syncing (yellow dot) — reconnecting or pending changes
 * - Offline (red dot) — no network or WebSocket disconnected
 *
 * The Yjs stack (y-indexeddb) already handles offline persistence
 * automatically. This component just provides visual feedback.
 */
export function OfflineIndicator() {
    const connectionStatus = usePresenceStore((s) => s.connectionStatus);
    const isSynced = usePresenceStore((s) => s.isSynced);
    const pendingChanges = usePresenceStore((s) => s.pendingChanges);

    const [isOnline, setIsOnline] = useState(true);
    const [detailsOpen, setDetailsOpen] = useState(false);

    // Track browser online/offline
    useEffect(() => {
        const updateOnline = () => setIsOnline(navigator.onLine);
        updateOnline();
        window.addEventListener('online', updateOnline);
        window.addEventListener('offline', updateOnline);
        return () => {
            window.removeEventListener('online', updateOnline);
            window.removeEventListener('offline', updateOnline);
        };
    }, []);

    // Determine visual state
    const getState = useCallback(() => {
        if (!isOnline) {
            return {
                color: 'bg-red-500',
                pulseColor: 'bg-red-400',
                label: 'Hors ligne',
                description: 'Les modifications sont sauvegardees localement et seront synchronisees automatiquement.',
                icon: WifiOff,
                pulse: true,
            };
        }

        if (connectionStatus === 'reconnecting') {
            return {
                color: 'bg-amber-500',
                pulseColor: 'bg-amber-400',
                label: 'Reconnexion...',
                description: 'Tentative de reconnexion au serveur de collaboration.',
                icon: RefreshCw,
                pulse: true,
            };
        }

        if (connectionStatus === 'disconnected') {
            if (pendingChanges > 0) {
                return {
                    color: 'bg-amber-500',
                    pulseColor: 'bg-amber-400',
                    label: 'Mode local',
                    description: `${pendingChanges} modification(s) en attente de synchronisation.`,
                    icon: CloudOff,
                    pulse: true,
                };
            }
            return {
                color: 'bg-gray-400',
                pulseColor: 'bg-gray-300',
                label: 'Mode local',
                description: 'Collaboration desactivee. Les modifications sont sauvegardees localement.',
                icon: CloudOff,
                pulse: false,
            };
        }

        if (connectionStatus === 'connected' && isSynced) {
            return {
                color: 'bg-emerald-500',
                pulseColor: 'bg-emerald-400',
                label: 'Connecte',
                description: 'Document synchronise en temps reel.',
                icon: Wifi,
                pulse: false,
            };
        }

        if (connectionStatus === 'connected' && !isSynced) {
            return {
                color: 'bg-amber-500',
                pulseColor: 'bg-amber-400',
                label: 'Synchronisation...',
                description: 'Synchronisation des modifications en cours.',
                icon: RefreshCw,
                pulse: true,
            };
        }

        // Connecting
        return {
            color: 'bg-amber-500',
            pulseColor: 'bg-amber-400',
            label: 'Connexion...',
            description: 'Connexion au serveur de collaboration.',
            icon: RefreshCw,
            pulse: true,
        };
    }, [isOnline, connectionStatus, isSynced, pendingChanges]);

    const state = getState();
    const Icon = state.icon;

    return (
        <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
            <PopoverTrigger asChild>
                <button
                    className="flex items-center gap-1.5 px-2 bg-muted/30 rounded-full py-1 border border-border/50 hover:bg-muted/50 transition-colors"
                    title={state.label}
                >
                    <div className="relative">
                        <div className={`w-2 h-2 rounded-full ${state.color}`} />
                        {state.pulse && (
                            <div className={`absolute inset-0 w-2 h-2 rounded-full ${state.pulseColor} animate-ping`} />
                        )}
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
                        {state.label}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${state.color} shrink-0`} />
                        <span className="text-sm font-medium">{state.label}</span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {state.description}
                    </p>

                    {/* Status details */}
                    <div className="space-y-1.5 pt-1 border-t">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Reseau</span>
                            <span className={`font-medium ${isOnline ? 'text-emerald-600' : 'text-red-500'}`}>
                                {isOnline ? 'En ligne' : 'Hors ligne'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Collaboration</span>
                            <span className={`font-medium ${
                                connectionStatus === 'connected' ? 'text-emerald-600' :
                                connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? 'text-amber-600' :
                                'text-muted-foreground'
                            }`}>
                                {connectionStatus === 'connected' ? 'Active' :
                                 connectionStatus === 'connecting' ? 'Connexion...' :
                                 connectionStatus === 'reconnecting' ? 'Reconnexion...' :
                                 'Desactivee'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Stockage local</span>
                            <span className="font-medium text-emerald-600">IndexedDB actif</span>
                        </div>
                        {pendingChanges > 0 && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Modifications en attente</span>
                                <span className="font-medium text-amber-600">{pendingChanges}</span>
                            </div>
                        )}
                    </div>

                    {!isOnline && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                            Vos modifications sont sauvegardees automatiquement en local. Elles seront synchronisees des que la connexion sera retablie.
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
