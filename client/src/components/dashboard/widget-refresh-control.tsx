'use client';

// IDEA-124: Per-widget refresh interval — configurable auto-refresh

import { useEffect, useRef, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { cn } from '@/lib/utils';

export const REFRESH_OPTIONS = [
  { value: 0, label: 'Manuel' },
  { value: 30, label: '30 sec' },
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
  { value: 900, label: '15 min' },
];

interface WidgetRefreshControlProps {
  widgetId: string;
  currentInterval?: number;
  onRefresh?: () => void;
  className?: string;
}

export function WidgetRefreshControl({
  widgetId,
  currentInterval = 0,
  onRefresh,
  className,
}: WidgetRefreshControlProps) {
  const updateWidgetConfig = useDashboardStore((s) => s.updateWidgetConfig);
  const [spinning, setSpinning] = useState(false);

  const handleManualRefresh = () => {
    setSpinning(true);
    onRefresh?.();
    setTimeout(() => setSpinning(false), 800);
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <button
        onClick={handleManualRefresh}
        className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        title="Rafraîchir maintenant"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', spinning && 'animate-spin')} />
      </button>
      <Select
        value={String(currentInterval)}
        onValueChange={(v) => updateWidgetConfig(widgetId, { refreshInterval: Number(v) })}
      >
        <SelectTrigger className="h-6 text-[10px] px-2 w-20 border-0 bg-transparent text-muted-foreground hover:bg-accent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REFRESH_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={String(o.value)} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Hook to trigger auto-refresh based on widgetConfig.refreshInterval
export function useWidgetAutoRefresh(
  refreshInterval: number | undefined,
  onRefresh: () => void
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!refreshInterval || refreshInterval <= 0) return;

    intervalRef.current = setInterval(onRefresh, refreshInterval * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshInterval, onRefresh]);
}
