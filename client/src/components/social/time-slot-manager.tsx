'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { socialApi } from '@/lib/api/social';
import type { TimeSlot } from '@/lib/api/social';
import { useSocialStore } from '@/stores/social-store';
import { PLATFORM_COLORS, PLATFORM_LABELS } from './platform-utils';

// --- Constants ---

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am to 11pm

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

// --- Main Component ---

export function TimeSlotManager() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState('all');

  const { accounts, fetchAccounts } = useSocialStore();

  const accountOptions = useMemo(() => {
    const opts: { id: string; label: string; platform: string }[] = [
      { id: 'all', label: 'All accounts', platform: 'all' },
    ];
    for (const acc of accounts) {
      opts.push({
        id: acc.id,
        label: `@${acc.username} (${PLATFORM_LABELS[acc.platform] ?? acc.platform})`,
        platform: acc.platform,
      });
    }
    return opts;
  }, [accounts]);

  const accountColors: Record<string, string> = useMemo(() => {
    const colors: Record<string, string> = { all: '#3b82f6' };
    for (const acc of accounts) {
      colors[acc.id] = PLATFORM_COLORS[acc.platform] ?? '#3b82f6';
    }
    return colors;
  }, [accounts]);

  const fetchSlots = useCallback(async () => {
    try {
      setLoading(true);
      const res = await socialApi.timeSlots.list();
      setSlots(res.data);
    } catch {
      toast.error('Failed to load time slots');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
    if (accounts.length === 0) {
      fetchAccounts();
    }
  }, [fetchSlots, accounts.length, fetchAccounts]);

  const filteredSlots = useMemo(() => {
    if (accountFilter === 'all') return slots;
    return slots.filter(
      (s) => !s.accountIds || s.accountIds.length === 0 || s.accountIds.includes(accountFilter),
    );
  }, [slots, accountFilter]);

  const isSlotActive = useCallback(
    (day: number, hour: number) => {
      return filteredSlots.some((s) => s.dayOfWeek === day && s.hour === hour);
    },
    [filteredSlots],
  );

  const getSlotColor = useCallback(
    (day: number, hour: number) => {
      const slot = filteredSlots.find((s) => s.dayOfWeek === day && s.hour === hour);
      if (!slot) return undefined;
      if (slot.accountIds && slot.accountIds.length > 0) {
        return accountColors[slot.accountIds[0]] ?? '#3b82f6';
      }
      return '#3b82f6';
    },
    [filteredSlots, accountColors],
  );

  const toggleSlot = async (day: number, hour: number) => {
    const accountIds = accountFilter === 'all' ? undefined : [accountFilter];
    const existing = slots.find(
      (s) =>
        s.dayOfWeek === day &&
        s.hour === hour &&
        (accountFilter === 'all'
          ? !s.accountIds || s.accountIds.length === 0
          : s.accountIds?.includes(accountFilter)),
    );

    if (existing) {
      try {
        await socialApi.timeSlots.delete(existing.id);
        setSlots((prev) => prev.filter((s) => s.id !== existing.id));
      } catch {
        toast.error('Failed to remove time slot');
      }
    } else {
      try {
        const res = await socialApi.timeSlots.create({
          dayOfWeek: day,
          hour,
          minute: 0,
          accountIds,
        });
        setSlots((prev) => [...prev, res.data]);
      } catch {
        toast.error('Failed to add time slot');
      }
    }
  };

  // Summary stats
  const activeDays = useMemo(() => {
    const days = new Set(filteredSlots.map((s) => s.dayOfWeek));
    return days.size;
  }, [filteredSlots]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Time Slots</h2>
            <p className="text-sm text-muted-foreground">
              Define optimal posting times for your content queue
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm shrink-0">Account:</Label>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="py-4 px-4">
            {/* Grid Header */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-1">
              <div /> {/* empty corner */}
              {DAYS.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Body */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1">
              {HOURS.map((hour) => (
                <div key={hour} className="contents">
                  <div className="flex items-center justify-end pr-2 text-xs text-muted-foreground h-7">
                    {formatHour(hour)}
                  </div>
                  {DAYS.map((_, dayIdx) => {
                    const active = isSlotActive(dayIdx, hour);
                    const color = getSlotColor(dayIdx, hour);

                    return (
                      <Tooltip key={`${dayIdx}-${hour}`}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => toggleSlot(dayIdx, hour)}
                            className={`h-7 rounded-md border transition-all ${
                              active
                                ? 'border-transparent'
                                : 'border-border hover:border-primary/30 hover:bg-muted/50'
                            }`}
                            style={
                              active
                                ? {
                                    backgroundColor: `${color}20`,
                                    borderColor: color,
                                  }
                                : undefined
                            }
                          >
                            {active && (
                              <div
                                className="h-2.5 w-2.5 rounded-full mx-auto"
                                style={{ backgroundColor: color }}
                              />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {DAYS[dayIdx]} {formatHour(hour)}
                          {active ? ' (click to remove)' : ' (click to add)'}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            {filteredSlots.length} slot{filteredSlots.length !== 1 ? 's' : ''} configured
            {activeDays > 0 && ` across ${activeDays} day${activeDays !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="font-medium">Legend:</span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
            Global
          </span>
          {accounts.map((acc) => (
            <span key={acc.id} className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-full inline-block"
                style={{ backgroundColor: PLATFORM_COLORS[acc.platform] ?? '#6b7280' }}
              />
              {PLATFORM_LABELS[acc.platform] ?? acc.platform}
            </span>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
