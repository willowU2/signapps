'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Loader2, AlertCircle, ExternalLink, Settings } from 'lucide-react';
import { socialApi } from '@/lib/api/social';
import type { SocialAccount } from '@/lib/api/social';
import { OAuthSetupWizard } from './oauth-setup-wizard';

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------

interface PlatformDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  scopes: string;
  /** Platforms using manual credential entry instead of OAuth web flow */
  manualOnly?: boolean;
}

const PLATFORMS: PlatformDef[] = [
  {
    id: 'twitter',
    name: 'Twitter / X',
    icon: '𝕏',
    color: '#000000',
    scopes: 'Publier, lire, programmer',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '🔗',
    color: '#0A66C2',
    scopes: 'Publier, profil, analytics',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    scopes: 'Pages, publier, analytics',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📸',
    color: '#E4405F',
    scopes: 'Publier, stories, analytics',
  },
  {
    id: 'mastodon',
    name: 'Mastodon',
    icon: '🐘',
    color: '#6364FF',
    scopes: 'Publier, lire, notifications',
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    icon: '🦋',
    color: '#0085FF',
    scopes: 'Publier, lire',
    manualOnly: true,
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OAuthConnectProps {
  /** Currently connected accounts (used to show connected status per platform) */
  accounts: SocialAccount[];
  /** Called after a successful connection so the parent can refresh its list */
  onConnected: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OAuthConnect({ accounts, onConnected }: OAuthConnectProps) {
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);
  const [errorPlatform, setErrorPlatform] = useState<Record<string, string>>({});
  // Mastodon instance URL state
  const [mastodonInstance, setMastodonInstance] = useState('mastodon.social');
  const [showMastodonInput, setShowMastodonInput] = useState(false);
  // Setup wizard state
  const [wizardPlatform, setWizardPlatform] = useState<string | null>(null);

  // Listen for postMessage from OAuth popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const { type, platform, error } = event.data ?? {};

      if (type === 'oauth-success') {
        setLoadingPlatform(null);
        onConnected();
      } else if (type === 'oauth-error') {
        setLoadingPlatform(null);
        setErrorPlatform((prev) => ({
          ...prev,
          [platform]: error ?? 'Connection failed',
        }));
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onConnected]);

  // Also handle full-page redirect return (query param ?connected=true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      onConnected();
      // Remove params from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      url.searchParams.delete('platform');
      window.history.replaceState({}, '', url.toString());
    }
    if (params.get('oauth_error')) {
      const platform = params.get('platform') ?? 'unknown';
      const err = params.get('oauth_error') ?? 'error';
      setErrorPlatform((prev) => ({ ...prev, [platform]: err }));
      const url = new URL(window.location.href);
      url.searchParams.delete('oauth_error');
      url.searchParams.delete('platform');
      window.history.replaceState({}, '', url.toString());
    }
  }, [onConnected]);

  const handleConnect = useCallback(
    async (platform: PlatformDef) => {
      setErrorPlatform((prev) => {
        const copy = { ...prev };
        delete copy[platform.id];
        return copy;
      });
      setLoadingPlatform(platform.id);

      try {
        const params =
          platform.id === 'mastodon' ? { instance: mastodonInstance } : undefined;

        const { data } = await socialApi.oauth.authorize(platform.id, params);
        const { redirect_url } = data;

        // Try popup first; fall back to full-page redirect if blocked
        const popup = window.open(
          redirect_url,
          'signapps_oauth',
          'width=640,height=720,scrollbars=yes,resizable=yes',
        );

        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          // Popup blocked — full-page redirect
          window.location.href = redirect_url;
        } else {
          // Monitor popup closure (user closed it manually)
          const timer = setInterval(() => {
            if (popup.closed) {
              clearInterval(timer);
              setLoadingPlatform(null);
            }
          }, 500);
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.error ?? err?.message ?? 'Failed to start OAuth flow';
        setErrorPlatform((prev) => ({ ...prev, [platform.id]: msg }));
        setLoadingPlatform(null);
      }
    },
    [mastodonInstance],
  );

  const connectedForPlatform = (platformId: string) =>
    accounts.filter((a) => a.platform === platformId);

  const handleWizardSaved = useCallback(() => {
    if (wizardPlatform) {
      // Re-trigger OAuth flow for the platform now that credentials are saved
      const p = PLATFORMS.find((pl) => pl.id === wizardPlatform);
      setWizardPlatform(null);
      if (p) {
        // Small delay to let the dialog close cleanly
        setTimeout(() => handleConnect(p), 300);
      }
    }
  }, [wizardPlatform, handleConnect]);

  return (
    <>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {PLATFORMS.map((platform) => {
        const connected = connectedForPlatform(platform.id);
        const isLoading = loadingPlatform === platform.id;
        const error = errorPlatform[platform.id];

        return (
          <Card key={platform.id} className="overflow-hidden">
            {/* Colored top stripe */}
            <div className="h-1" style={{ backgroundColor: platform.color }} />
            <CardContent className="pt-4 pb-4 px-4 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
                  style={{ backgroundColor: platform.color }}
                >
                  {platform.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{platform.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{platform.scopes}</p>
                </div>
                {connected.length > 0 && (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                )}
              </div>

              {/* Connected accounts list */}
              {connected.length > 0 && (
                <div className="space-y-1">
                  {connected.map((acct) => (
                    <div key={acct.id} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        {acct.displayName ?? acct.username ?? 'Connected'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Mastodon instance input */}
              {platform.id === 'mastodon' && (
                <div className="space-y-1">
                  <Label className="text-xs">Instance</Label>
                  <Input
                    className="h-7 text-xs"
                    placeholder="mastodon.social"
                    value={mastodonInstance}
                    onChange={(e) => setMastodonInstance(e.target.value)}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="space-y-1.5">
                  <div className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                  {/* Show setup wizard button when OAuth is not configured (non-Mastodon platforms) */}
                  {error.includes('OAuth non configure') && platform.id !== 'mastodon' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs gap-1.5"
                      onClick={() => {
                        setErrorPlatform((prev) => {
                          const copy = { ...prev };
                          delete copy[platform.id];
                          return copy;
                        });
                        setWizardPlatform(platform.id);
                      }}
                    >
                      <Settings className="h-3 w-3" />
                      Configurer les credentials OAuth
                    </Button>
                  )}
                </div>
              )}

              {/* Connect button */}
              {platform.manualOnly ? (
                <p className="text-xs text-muted-foreground">
                  Uses app password — configure via the manual form below.
                </p>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  style={{ backgroundColor: platform.color, borderColor: platform.color }}
                  onClick={() => handleConnect(platform)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                      Connexion…
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-3.5 w-3.5 mr-2" />
                      {connected.length > 0 ? 'Reconnecter' : 'Connecter'} {platform.name}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
    {/* OAuth Setup Wizard dialog */}
    {wizardPlatform && (
      <OAuthSetupWizard
        platform={wizardPlatform}
        open={wizardPlatform !== null}
        onClose={() => setWizardPlatform(null)}
        onCredentialsSaved={handleWizardSaved}
      />
    )}
    </>
  );
}
