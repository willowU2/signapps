'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** Decode the payload of a JWT without verifying signature. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/** Returns { remaining: seconds, total: seconds } or null */
function getSessionTimes(): { remaining: number; total: number } | null {
  if (typeof window === 'undefined') return null;

  // Try cookies first (httpOnly won't be readable, fallback to localStorage)
  const token =
    localStorage.getItem('access_token') ||
    document.cookie
      .split('; ')
      .find((c) => c.startsWith('access_token='))
      ?.split('=')[1];

  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = payload.exp as number;
  const iat = (payload.iat as number) || now;
  const remaining = exp - now;
  const total = exp - iat;

  if (remaining <= 0) return null;
  return { remaining, total };
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export function SessionIndicator() {
  const [times, setTimes] = useState<{ remaining: number; total: number } | null>(null);

  const refresh = useCallback(() => {
    setTimes(getSessionTimes());
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000); // update every 30s
    return () => clearInterval(id);
  }, [refresh]);

  if (!times) return null;

  const { remaining } = times;
  const WARNING_THRESHOLD = 5 * 60; // 5 minutes

  // Dot color: green = active, yellow = expiring soon
  const isExpiringSoon = remaining <= WARNING_THRESHOLD;
  const dotColor = isExpiringSoon
    ? 'bg-yellow-400 shadow-yellow-400/50'
    : 'bg-green-500 shadow-green-500/50';

  const label = `Session : ${formatDuration(remaining)}`;
  const tooltipText = isExpiringSoon
    ? `Session expire bientôt (${formatDuration(remaining)})`
    : `Session active — expire dans ${formatDuration(remaining)}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors cursor-default select-none">
            <span
              className={`h-2 w-2 rounded-full ${dotColor} shadow-sm ${isExpiringSoon ? 'animate-pulse' : ''}`}
            />
            <span className="hidden sm:inline font-medium tabular-nums">
              {label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
