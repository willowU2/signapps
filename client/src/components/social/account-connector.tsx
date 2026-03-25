'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Trash2, RefreshCw, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { useSocialStore } from '@/stores/social-store';
import { PLATFORM_COLORS, PLATFORM_LABELS } from './platform-utils';
import type { SocialAccount } from '@/lib/api/social';
import { socialApi } from '@/lib/api/social';

type Platform = SocialAccount['platform'];

const SUPPORTED_PLATFORMS: { platform: Platform; description: string; comingSoon?: boolean }[] = [
  { platform: 'mastodon', description: 'Enter your instance URL and authorize via OAuth' },
  { platform: 'bluesky', description: 'Enter your handle and app password' },
  { platform: 'twitter', description: 'Connect via OAuth', comingSoon: true },
  { platform: 'facebook', description: 'Connect via Meta for Developers', comingSoon: true },
  { platform: 'instagram', description: 'Connect via Meta for Developers', comingSoon: true },
  { platform: 'linkedin', description: 'Connect via LinkedIn API', comingSoon: true },
];

interface ConnectDialogProps {
  platform: Platform;
  onClose: () => void;
  onConnect: (data: { platform: string; instanceUrl?: string; handle?: string; appPassword?: string }) => Promise<void>;
}

function ConnectDialog({ platform, onClose, onConnect }: ConnectDialogProps) {
  const [instanceUrl, setInstanceUrl] = useState('');
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await onConnect({
        platform,
        instanceUrl: platform === 'mastodon' ? instanceUrl : undefined,
        handle: platform === 'bluesky' ? handle : undefined,
        appPassword: platform === 'bluesky' ? appPassword : undefined,
      });
      onClose();
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Connect {PLATFORM_LABELS[platform]}</DialogTitle>
        <DialogDescription>
          {platform === 'mastodon' && 'Authorize SignApps on your Mastodon instance.'}
          {platform === 'bluesky' && 'Use your Bluesky handle and an app-specific password.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        {platform === 'mastodon' && (
          <div className="space-y-1">
            <Label>Instance URL</Label>
            <Input
              placeholder="https://mastodon.social"
              value={instanceUrl}
              onChange={(e) => setInstanceUrl(e.target.value)}
            />
          </div>
        )}
        {platform === 'bluesky' && (
          <>
            <div className="space-y-1">
              <Label>Handle</Label>
              <Input
                placeholder="yourhandle.bsky.social"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>App Password</Label>
              <Input
                type="password"
                placeholder="xxxx-xxxx-xxxx-xxxx"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Generate an app password at Settings → Privacy and Security → App Passwords
              </p>
            </div>
          </>
        )}
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting…' : 'Connect'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </DialogContent>
  );
}

export function AccountConnector() {
  const { accounts, fetchAccounts, addAccount, removeAccount, isLoadingAccounts } = useSocialStore();
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleRefreshToken = async (id: string) => {
    setRefreshingId(id);
    try {
      await socialApi.accounts.refreshToken(id);
      await fetchAccounts();
    } finally {
      setRefreshingId(null);
    }
  };

  const connectedByPlatform = SUPPORTED_PLATFORMS.map((sp) => ({
    ...sp,
    connected: accounts.filter((a) => a.platform === sp.platform),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Connected Accounts</h2>
        <p className="text-sm text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Connected accounts list */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h3>
          <div className="space-y-2">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {account.avatar ? (
                      <img src={account.avatar} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: PLATFORM_COLORS[account.platform] }}
                      >
                        {account.platform.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{account.displayName}</span>
                        <span className="text-muted-foreground text-sm">@{account.username}</span>
                        <Badge
                          variant="outline"
                          className="text-xs capitalize"
                          style={{ borderColor: PLATFORM_COLORS[account.platform] }}
                        >
                          {account.platform}
                        </Badge>
                        {account.status === 'connected' ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                        )}
                      </div>
                      {account.followersCount != null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {account.followersCount.toLocaleString()} followers
                        </p>
                      )}
                      {account.instanceUrl && (
                        <p className="text-xs text-muted-foreground">{account.instanceUrl}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {account.status !== 'connected' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshToken(account.id)}
                          disabled={refreshingId === account.id}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshingId === account.id ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeAccount(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add accounts */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Add Account</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {connectedByPlatform.map(({ platform, description, comingSoon, connected }) => (
            <Card key={platform} className={comingSoon ? 'opacity-60' : ''}>
              <CardContent className="py-4 px-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: PLATFORM_COLORS[platform] }}
                  >
                    {platform.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{PLATFORM_LABELS[platform]}</span>
                      {comingSoon && <Badge variant="secondary" className="text-xs">Coming Soon</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    {connected.length > 0 && (
                      <p className="text-xs text-green-500 mt-1">{connected.length} account{connected.length !== 1 ? 's' : ''} connected</p>
                    )}
                  </div>
                </div>
                {!comingSoon && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => setConnectingPlatform(platform)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Connect {PLATFORM_LABELS[platform]}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Connect Dialog */}
      <Dialog open={!!connectingPlatform} onOpenChange={(open) => !open && setConnectingPlatform(null)}>
        {connectingPlatform && (
          <ConnectDialog
            platform={connectingPlatform}
            onClose={() => setConnectingPlatform(null)}
            onConnect={addAccount}
          />
        )}
      </Dialog>
    </div>
  );
}
