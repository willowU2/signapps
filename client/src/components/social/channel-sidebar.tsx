/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useSocialStore } from '@/stores/social-store';
import { PLATFORM_COLORS, PLATFORM_LABELS } from './platform-utils';
import type { SocialAccount } from '@/lib/api/social';

const STORAGE_KEY = 'social-channel-sidebar-collapsed';

function PlatformIcon({ platform, size = 18 }: { platform: SocialAccount['platform']; size?: number }) {
  const color = PLATFORM_COLORS[platform];
  switch (platform) {
    case 'twitter':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case 'mastodon':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 00.023-.043v-1.809a.052.052 0 00-.02-.041.053.053 0 00-.046-.01 20.282 20.282 0 01-4.709.547c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 01-.319-1.433.053.053 0 01.066-.054 19.648 19.648 0 004.636.546c.568 0 1.133-.014 1.691-.048 2.135-.129 4.42-.549 4.905-3.414.016-.093.03-.202.044-.314.095-.782.166-2.255.166-3.046 0-.882-.243-3.203-.267-3.41zM19.903 13.16h-2.765V7.874c0-1.115-.474-1.681-1.42-1.681-1.048 0-1.572.672-1.572 2v2.917h-2.75V8.193c0-1.328-.524-2-1.572-2-.946 0-1.42.566-1.42 1.68v5.287H5.64V7.658c0-1.115.285-2 .856-2.658.59-.658 1.363-.995 2.32-.995 1.108 0 1.946.426 2.505 1.276L12 6.347l.68-1.066c.559-.85 1.397-1.276 2.505-1.276.957 0 1.73.337 2.32.995.571.658.856 1.543.856 2.658v5.501z" />
        </svg>
      );
    case 'bluesky':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.603 3.496 6.159 3.072-4.476.78-8.4 2.677-3.156 9.44 5.7 6.627 8.188-1.747 8.373-3.31.185 1.563 2.673 9.937 8.373 3.31 5.244-6.763 1.32-8.66-3.156-9.44 2.556.424 5.374-.445 6.16-3.072.245-.829.623-5.789.623-6.479 0-.688-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z" />
        </svg>
      );
    default:
      return null;
  }
}

function getStatusColor(status: SocialAccount['status']): string {
  switch (status) {
    case 'connected':
      return 'bg-green-500';
    case 'error':
      return 'bg-red-500';
    case 'expired':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-400';
  }
}

function getStatusLabel(status: SocialAccount['status']): string {
  switch (status) {
    case 'connected':
      return 'Connecté';
    case 'error':
      return 'Error - reconnect needed';
    case 'expired':
      return 'Token expired - refresh needed';
    default:
      return 'Unknown';
  }
}

interface ChannelSidebarProps {
  selectedAccountIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function ChannelSidebar({ selectedAccountIds, onSelectionChange }: ChannelSidebarProps) {
  const { accounts, fetchAccounts } = useSocialStore();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // storage unavailable
    }
  }, [collapsed]);

  const handleChannelClick = useCallback(
    (accountId: string, event: React.MouseEvent) => {
      if (event.shiftKey) {
        // Multi-select: toggle the account in or out
        if (selectedAccountIds.includes(accountId)) {
          onSelectionChange(selectedAccountIds.filter((id) => id !== accountId));
        } else {
          onSelectionChange([...selectedAccountIds, accountId]);
        }
      } else {
        // Single select: toggle or replace
        if (selectedAccountIds.length === 1 && selectedAccountIds[0] === accountId) {
          onSelectionChange([]); // deselect if clicking same one
        } else {
          onSelectionChange([accountId]);
        }
      }
    },
    [selectedAccountIds, onSelectionChange]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="flex flex-col border-r bg-card shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: collapsed ? 64 : 260 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 h-12">
          <span
            className={`text-sm font-semibold whitespace-nowrap transition-opacity duration-200 ${
              collapsed ? 'opacity-0 w-0' : 'opacity-100'
            }`}
          >
            Channels
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setCollapsed((prev) => !prev)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Separator />

        {/* Account List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
          {accounts.length === 0 && (
            <p
              className={`text-xs text-muted-foreground text-center py-4 transition-opacity duration-200 ${
                collapsed ? 'opacity-0' : 'opacity-100'
              }`}
            >
              No accounts connected
            </p>
          )}

          {accounts.map((account) => {
            const isSelected = selectedAccountIds.includes(account.id);
            const statusColor = getStatusColor(account.status);
            const statusLabel = getStatusLabel(account.status);

            const channelButton = (
              <button
                key={account.id}
                onClick={(e) => handleChannelClick(account.id, e)}
                className={`w-full flex items-center gap-3 rounded-lg transition-all duration-150 ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
                } ${
                  isSelected
                    ? 'bg-primary/10 ring-1 ring-primary/30'
                    : 'hover:bg-muted/60'
                }`}
              >
                {/* Platform icon + status dot */}
                <div className="relative shrink-0">
                  {account.avatar && !collapsed ? (
                    <img
                      src={account.avatar}
                      alt={account.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${PLATFORM_COLORS[account.platform]}18` }}
                    >
                      <PlatformIcon platform={account.platform} size={16} />
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${statusColor}`}
                    title={statusLabel}
                  />
                </div>

                {/* Text info (hidden when collapsed) */}
                <div
                  className={`flex-1 min-w-0 text-left transition-opacity duration-200 ${
                    collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <PlatformIcon platform={account.platform} size={12} />
                    <span className="text-xs font-medium truncate">
                      @{account.username}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {PLATFORM_LABELS[account.platform]}
                    {account.followersCount != null && ` \u00b7 ${account.followersCount.toLocaleString()} followers`}
                  </p>
                </div>
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip key={account.id}>
                  <TooltipTrigger asChild>{channelButton}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <div className="space-y-0.5">
                      <p className="font-medium">@{account.username}</p>
                      <p className="text-xs opacity-80">{PLATFORM_LABELS[account.platform]}</p>
                      <p className="text-xs opacity-80">{statusLabel}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return channelButton;
          })}
        </div>

        <Separator />

        {/* Add Account Button */}
        <div className="p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-9"
                  asChild
                >
                  <Link href="/social/accounts">
                    <Plus className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Add account
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/social/accounts">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Link>
            </Button>
          )}
        </div>

        {/* Selection hint */}
        {!collapsed && accounts.length > 1 && (
          <p className="text-xs text-muted-foreground text-center pb-2 px-2">
            Shift+click to multi-select
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
