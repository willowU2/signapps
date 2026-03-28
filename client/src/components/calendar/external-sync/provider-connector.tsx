'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * ProviderConnector Component
 *
 * Allows connecting to external calendar providers (Google, Microsoft, Apple).
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, AlertCircle, ExternalLink, RefreshCw, Trash2, Link2, Link2Off, Cloud, Mail } from 'lucide-react';
import { useExternalSyncStore } from '@/stores/external-sync-store';
import type {
  CalendarProvider,
  ProviderConnection,
} from '@/lib/calendar/external-sync/types';
import {
  PROVIDER_LABELS,
  PROVIDER_COLORS,
  SYNC_STATUS_LABELS,
  SYNC_STATUS_COLORS,
} from '@/lib/calendar/external-sync/types';

// ============================================================================
// Provider Icons
// ============================================================================

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
      <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

function CalDavIcon({ className }: { className?: string }) {
  return <Cloud className={className} />;
}

const PROVIDER_ICON_COMPONENTS: Record<CalendarProvider, React.FC<{ className?: string }>> = {
  google: GoogleIcon,
  microsoft: MicrosoftIcon,
  apple: AppleIcon,
  caldav: CalDavIcon,
};

// ============================================================================
// Provider Card
// ============================================================================

interface ProviderCardProps {
  provider: CalendarProvider;
  connection: ProviderConnection | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  isConnecting: boolean;
}

function ProviderCard({
  provider,
  connection,
  onConnect,
  onDisconnect,
  onRefresh,
  isConnecting,
}: ProviderCardProps) {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const IconComponent = PROVIDER_ICON_COMPONENTS[provider];
  const isConnecté = connection?.is_connected ?? false;

  const handleDisconnect = () => {
    onDisconnect();
    setShowDisconnectDialog(false);
  };

  return (
    <>
      <Card className={isConnecté ? 'border-green-200 dark:border-green-900' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${PROVIDER_COLORS[provider]}20` }}
              >
                <IconComponent className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base">{PROVIDER_LABELS[provider]}</CardTitle>
                {connection && (
                  <CardDescription className="text-sm">
                    {connection.account_email}
                  </CardDescription>
                )}
              </div>
            </div>
            {isConnecté && (
              <Badge
                variant="outline"
                className={SYNC_STATUS_COLORS[connection?.sync_status || 'idle']}
              >
                {SYNC_STATUS_LABELS[connection?.sync_status || 'idle']}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isConnecté ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-500" />
                <span>Connecté</span>
                {connection?.last_sync_at && (
                  <span className="ml-auto">
                    Dernière sync: {new Date(connection.last_sync_at).toLocaleString('fr-FR')}
                  </span>
                )}
              </div>

              {connection?.sync_error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{connection.sync_error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isConnecting}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isConnecting ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectDialog(true)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Link2Off className="h-4 w-4 mr-2" />
                  Déconnecter
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={onConnect}
              disabled={isConnecting}
              className="w-full"
              style={{ backgroundColor: PROVIDER_COLORS[provider] }}
            >
              {isConnecting ? (
                <>
                  <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 mr-2 " />
                  Connexion...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connecter {PROVIDER_LABELS[provider]}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déconnecter {PROVIDER_LABELS[provider]} ?</DialogTitle>
            <DialogDescription>
              Cette action supprimera la connexion et arrêtera la synchronisation.
              Vos événements existants ne seront pas supprimés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnectDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDisconnect}>
              <Trash2 className="h-4 w-4 mr-2" />
              Déconnecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ProviderConnectorProps {
  className?: string;
  onConnectionChange?: (connection: ProviderConnection) => void;
}

export function ProviderConnector({
  className,
  onConnectionChange,
}: ProviderConnectorProps) {
  const {
    connections,
    isLoadingConnections,
    error,
    loadConnections,
    connectProvider,
    disconnectProvider,
    refreshToken,
    clearError,
  } = useExternalSyncStore();

  const [connectingProvider, setConnectingProvider] = useState<CalendarProvider | null>(null);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleConnect = useCallback(
    async (provider: CalendarProvider) => {
      setConnectingProvider(provider);
      clearError();

      try {
        const redirectUri = `${window.location.origin}/settings/calendar/callback`;
        const authUrl = await connectProvider(provider, redirectUri);

        // Open OAuth popup
        const popup = window.open(
          authUrl,
          `${provider}_oauth`,
          'width=600,height=700,left=200,top=100'
        );

        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site.');
        }

        // Poll for popup closure
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            setConnectingProvider(null);
            loadConnections();
          }
        }, 500);
      } catch (err) {
        setConnectingProvider(null);
      }
    },
    [connectProvider, loadConnections, clearError]
  );

  const handleDisconnect = useCallback(
    async (connectionId: string) => {
      await disconnectProvider(connectionId);
    },
    [disconnectProvider]
  );

  const handleRefresh = useCallback(
    async (connectionId: string) => {
      setConnectingProvider(
        connections.find((c) => c.id === connectionId)?.provider || null
      );
      await refreshToken(connectionId);
      setConnectingProvider(null);
    },
    [connections, refreshToken]
  );

  const getConnection = (provider: CalendarProvider) =>
    connections.find((c) => c.provider === provider);

  const availableProviders: CalendarProvider[] = ['google', 'microsoft', 'apple', 'caldav'];

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Calendriers externes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Synchronisez vos calendriers Google, Microsoft et Apple
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoadingConnections ? (
        <div className="flex items-center justify-center py-12">
          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8  text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {availableProviders.map((provider) => (
            <ProviderCard
              key={provider}
              provider={provider}
              connection={getConnection(provider)}
              onConnect={() => handleConnect(provider)}
              onDisconnect={() => {
                const conn = getConnection(provider);
                if (conn) handleDisconnect(conn.id);
              }}
              onRefresh={() => {
                const conn = getConnection(provider);
                if (conn) handleRefresh(conn.id);
              }}
              isConnecting={connectingProvider === provider}
            />
          ))}
        </div>
      )}

      <div className="mt-8 p-4 rounded-lg bg-muted/50">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Confidentialité</p>
            <p className="text-muted-foreground mt-1">
              Nous n'accédons qu'aux informations de calendrier nécessaires à la synchronisation.
              Vos données ne sont jamais partagées avec des tiers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProviderConnector;
