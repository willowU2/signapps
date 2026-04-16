"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ChevronDown,
} from "lucide-react";
import { useSocialStore } from "@/stores/social-store";
import { PLATFORM_COLORS, PLATFORM_LABELS } from "./platform-utils";
import type { SocialAccount } from "@/lib/api/social";
import { socialApi } from "@/lib/api/social";
import { OAuthConnect } from "./oauth-connect";

type Platform = SocialAccount["platform"];

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password";
  hint?: string;
}

interface PlatformConfig {
  platform: Platform;
  description: string;
  fields: FieldDef[];
}

// Manual entry config — kept as "Advanced" option for power users / API tokens
const MANUAL_PLATFORMS: PlatformConfig[] = [
  {
    platform: "mastodon",
    description: "Enter your instance URL and authorize via OAuth",
    fields: [
      {
        key: "instanceUrl",
        label: "Instance URL",
        placeholder: "https://mastodon.social",
      },
    ],
  },
  {
    platform: "bluesky",
    description: "Enter your handle and app-specific password",
    fields: [
      { key: "handle", label: "Handle", placeholder: "yourhandle.bsky.social" },
      {
        key: "appPassword",
        label: "App Password",
        placeholder: "xxxx-xxxx-xxxx-xxxx",
        type: "password",
        hint: "Generate at Settings → Privacy and Security → App Passwords",
      },
    ],
  },
  {
    platform: "twitter",
    description: "Connect with your Twitter / X OAuth2 access token",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "Your OAuth2 access token",
        type: "password",
      },
      { key: "username", label: "Username", placeholder: "@handle" },
    ],
  },
  {
    platform: "facebook",
    description: "Connect with your Facebook Page access token",
    fields: [
      {
        key: "accessToken",
        label: "Page Access Token",
        placeholder: "EAAxxxxxx...",
        type: "password",
      },
      { key: "pageId", label: "Page ID", placeholder: "123456789012345" },
      { key: "username", label: "Page Name", placeholder: "My Page Name" },
    ],
  },
  {
    platform: "instagram",
    description: "Connect via Instagram Graph API (Business / Creator account)",
    fields: [
      {
        key: "accessToken",
        label: "Page Access Token",
        placeholder: "EAAxxxxxx...",
        type: "password",
      },
      {
        key: "userId",
        label: "Instagram Account ID",
        placeholder: "17841400000000000",
      },
      { key: "username", label: "Username", placeholder: "@yourhandle" },
    ],
  },
  {
    platform: "linkedin",
    description: "Connect with your LinkedIn OAuth2 access token",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "AQxxxxxx...",
        type: "password",
      },
      {
        key: "authorUrn",
        label: "Author URN",
        placeholder: "urn:li:person:ABC123",
      },
      { key: "username", label: "Display Name", placeholder: "Your Name" },
    ],
  },
  {
    platform: "tiktok",
    description: "Connect with your TikTok Content API credentials",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "act.xxxxxx...",
        type: "password",
      },
      { key: "openId", label: "Open ID", placeholder: "Your TikTok open_id" },
      { key: "username", label: "Username", placeholder: "@yourhandle" },
    ],
  },
  {
    platform: "youtube",
    description: "Connect via Google OAuth2 (YouTube Data API v3)",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "ya29.xxxxxx...",
        type: "password",
      },
      {
        key: "channelId",
        label: "Channel ID",
        placeholder: "UCxxxxxxxxxxxxxxxxxxxxxxxx",
      },
      { key: "username", label: "Channel Name", placeholder: "My Channel" },
    ],
  },
  {
    platform: "pinterest",
    description: "Connect with your Pinterest API v5 credentials",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "Your Pinterest OAuth token",
        type: "password",
      },
      {
        key: "boardId",
        label: "Default Board ID",
        placeholder: "123456789012345678",
      },
      { key: "username", label: "Username", placeholder: "yourpinterest" },
    ],
  },
  {
    platform: "threads",
    description: "Connect via Threads API (Meta)",
    fields: [
      {
        key: "accessToken",
        label: "Access Token",
        placeholder: "THxxxxxx...",
        type: "password",
      },
      {
        key: "userId",
        label: "Threads User ID",
        placeholder: "17841400000000000",
      },
      { key: "username", label: "Username", placeholder: "@yourhandle" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Manual connect dialog
// ---------------------------------------------------------------------------

interface ConnectDialogProps {
  config: PlatformConfig;
  onClose: () => void;
  onConnect: (data: Record<string, string>) => Promise<void>;
}

function ConnectDialog({ config, onClose, onConnect }: ConnectDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isConnecting, setIsConnecting] = useState(false);

  const setValue = (key: string, val: string) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await onConnect({ platform: config.platform, ...values });
      onClose();
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Connect {PLATFORM_LABELS[config.platform]}</DialogTitle>
        <DialogDescription>{config.description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        {config.fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label>{field.label}</Label>
            <Input
              type={field.type ?? "text"}
              placeholder={field.placeholder}
              value={values[field.key] ?? ""}
              onChange={(e) => setValue(field.key, e.target.value)}
            />
            {field.hint && (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            )}
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting…" : "Connect"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AccountConnector() {
  const { accounts, fetchAccounts, addAccount, removeAccount } =
    useSocialStore();
  const [connectingConfig, setConnectingConfig] =
    useState<PlatformConfig | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Comptes connectés</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connectez vos réseaux sociaux via OAuth sécurisé
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {accounts.length} compte{accounts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* OAuth connect grid — primary UX */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Connecter via OAuth
        </h3>
        <OAuthConnect accounts={accounts} onConnected={fetchAccounts} />
      </div>

      {/* Connected accounts list */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Comptes actifs
          </h3>
          <div className="space-y-2">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {account.avatar ? (
                      <Image
                        src={account.avatar}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{
                          backgroundColor:
                            PLATFORM_COLORS[account.platform] ?? "#6b7280",
                        }}
                      >
                        {account.platform.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {account.displayName}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {account.username ? `@${account.username}` : ""}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs capitalize"
                          style={{
                            borderColor:
                              PLATFORM_COLORS[account.platform] ?? "#6b7280",
                          }}
                        >
                          {PLATFORM_LABELS[account.platform] ??
                            account.platform}
                        </Badge>
                        {account.status === "connected" ? (
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
                        <p className="text-xs text-muted-foreground">
                          {account.instanceUrl}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {account.status !== "connected" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshToken(account.id)}
                          disabled={refreshingId === account.id}
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 mr-1 ${refreshingId === account.id ? "animate-spin" : ""}`}
                          />
                          Refresh
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeAccount(account.id)}
                        aria-label="Supprimer"
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

      {/* Advanced: manual token entry */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown
              className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
            Saisie manuelle de token (avancé)
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {MANUAL_PLATFORMS.map(({ platform, description, fields }) => {
              const connected = accounts.filter((a) => a.platform === platform);
              return (
                <Card key={platform}>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
                        style={{
                          backgroundColor:
                            PLATFORM_COLORS[platform] ?? "#6b7280",
                        }}
                      >
                        {platform.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">
                          {PLATFORM_LABELS[platform]}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {description}
                        </p>
                        {connected.length > 0 && (
                          <p className="text-xs text-green-500 mt-1">
                            {connected.length} compte
                            {connected.length !== 1 ? "s" : ""} connecté
                            {connected.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() =>
                        setConnectingConfig({ platform, description, fields })
                      }
                    >
                      Connecter {PLATFORM_LABELS[platform]}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Manual connect dialog */}
      <Dialog
        open={!!connectingConfig}
        onOpenChange={(open) => !open && setConnectingConfig(null)}
      >
        {connectingConfig && (
          <ConnectDialog
            config={connectingConfig}
            onClose={() => setConnectingConfig(null)}
            onConnect={addAccount}
          />
        )}
      </Dialog>
    </div>
  );
}
