'use client';

import { useState, useEffect, useMemo } from 'react';
import { Clock, TrendingUp, Plus, Loader2, Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSocialStore } from '@/stores/social-store';
import { socialApi } from '@/lib/api/social';
import { PLATFORM_COLORS, PLATFORM_LABELS } from './platform-utils';
import { format, addDays, startOfDay, setHours, setMinutes, isFuture } from 'date-fns';
import { toast } from 'sonner';

interface SlotRecommendation {
  date: Date;
  platforms: string[];
  reason: string;
  score: number;
}

const BEST_HOURS_BY_PLATFORM: Record<string, { hours: number[]; reason: string }> = {
  twitter: { hours: [9, 12, 17], reason: 'Peak engagement for Twitter/X' },
  linkedin: { hours: [8, 10, 17], reason: 'Peak engagement for LinkedIn' },
  instagram: { hours: [11, 13, 19], reason: 'Peak engagement for Instagram' },
  facebook: { hours: [13, 15, 19], reason: 'Peak engagement for Facebook' },
  tiktok: { hours: [7, 19, 21], reason: 'Peak engagement for TikTok' },
  youtube: { hours: [15, 17, 20], reason: 'Peak engagement for YouTube' },
  pinterest: { hours: [8, 20, 21], reason: 'Peak engagement for Pinterest' },
  threads: { hours: [9, 12, 18], reason: 'Peak engagement for Threads' },
  mastodon: { hours: [10, 14, 20], reason: 'Peak engagement for Mastodon' },
  bluesky: { hours: [9, 13, 18], reason: 'Peak engagement for Bluesky' },
};

interface SlotFinderProps {
  onSchedule?: (date: Date, platforms: string[]) => void;
}

export function SlotFinder({ onSchedule }: SlotFinderProps) {
  const { posts, accounts, fetchPosts, fetchAccounts } = useSocialStore();
  const [loading, setLoading] = useState(false);
  const [timeSlots, setTimeSlots] = useState<{ dayOfWeek: number; hour: number }[]>([]);

  useEffect(() => {
    const loadTimeSlots = async () => {
      try {
        const res = await socialApi.timeSlots.list();
        setTimeSlots(res.data.map((s: { dayOfWeek: number; hour: number }) => ({ dayOfWeek: s.dayOfWeek, hour: s.hour })));
      } catch {
        // silent — use best-time fallback only
      }
    };

    if (accounts.length === 0) fetchAccounts();
    fetchPosts();
    loadTimeSlots();
  }, [accounts.length, fetchAccounts, fetchPosts]);

  const activePlatforms = useMemo(
    () => [...new Set(accounts.filter((a) => a.isActive).map((a) => a.platform))],
    [accounts]
  );

  const scheduledDatetimes = useMemo(
    () =>
      posts
        .filter((p) => p.scheduledAt && p.status === 'scheduled')
        .map((p) => new Date(p.scheduledAt!).getTime()),
    [posts]
  );

  const recommendations = useMemo((): SlotRecommendation[] => {
    const slots: SlotRecommendation[] = [];
    const now = new Date();

    for (let dayOffset = 0; dayOffset <= 14 && slots.length < 15; dayOffset++) {
      const day = addDays(startOfDay(now), dayOffset);
      const dayOfWeek = day.getDay();

      // Check configured time slots first
      const configuredHours = timeSlots
        .filter((s) => s.dayOfWeek === dayOfWeek)
        .map((s) => s.hour);

      // Collect all candidate hours (configured + best-practice)
      const platformHours: Map<string, number[]> = new Map();
      for (const platform of activePlatforms.length > 0 ? activePlatforms : ['twitter', 'linkedin']) {
        const best = BEST_HOURS_BY_PLATFORM[platform]?.hours ?? [9, 12, 17];
        const combined = [...new Set([...configuredHours, ...best])];
        platformHours.set(platform, combined);
      }

      const hoursToCheck = new Set<number>();
      platformHours.forEach((hours) => hours.forEach((h) => hoursToCheck.add(h)));

      for (const hour of Array.from(hoursToCheck).sort((a, b) => a - b)) {
        const slotDate = setMinutes(setHours(day, hour), 0);
        if (!isFuture(slotDate)) continue;
        if (slots.length >= 10) break;

        // Skip if already occupied within 30 min
        const slotMs = slotDate.getTime();
        const occupied = scheduledDatetimes.some((t) => Math.abs(t - slotMs) < 30 * 60 * 1000);
        if (occupied) continue;

        // Find which platforms recommend this hour
        const matchingPlatforms = (activePlatforms.length > 0 ? activePlatforms : ['twitter', 'linkedin']).filter(
          (p) => {
            const best = BEST_HOURS_BY_PLATFORM[p]?.hours ?? [9, 12, 17];
            return best.includes(hour) || configuredHours.includes(hour);
          }
        );

        const reasons: string[] = [];
        const uniqueReasons = new Set<string>();
        for (const p of matchingPlatforms) {
          const r = BEST_HOURS_BY_PLATFORM[p]?.reason;
          if (r && !uniqueReasons.has(r)) {
            uniqueReasons.add(r);
            reasons.push(r);
          }
        }
        if (configuredHours.includes(hour)) reasons.unshift('Configured time slot');

        const score = matchingPlatforms.length + (configuredHours.includes(hour) ? 2 : 0);

        slots.push({
          date: slotDate,
          platforms: matchingPlatforms.length > 0 ? matchingPlatforms : activePlatforms,
          reason: reasons[0] ?? 'Recommended posting time',
          score,
        });
      }
    }

    return slots.sort((a, b) => b.score - a.score || a.date.getTime() - b.date.getTime()).slice(0, 10);
  }, [activePlatforms, timeSlots, scheduledDatetimes]);

  const handleSchedule = (slot: SlotRecommendation) => {
    if (onSchedule) {
      onSchedule(slot.date, slot.platforms);
    } else {
      toast.success(`Slot selected: ${format(slot.date, 'EEE MMM d, HH:mm')}`);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-500" />
          Best Available Slots
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No accounts connected. Connect accounts to see recommendations.
          </p>
        ) : (
          <div className="space-y-2">
            {recommendations.map((slot, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex flex-col items-center text-center min-w-[48px]">
                    <span className="text-xs text-muted-foreground font-medium uppercase">
                      {format(slot.date, 'EEE')}
                    </span>
                    <span className="text-lg font-bold leading-tight">{format(slot.date, 'd')}</span>
                    <span className="text-xs text-muted-foreground">{format(slot.date, 'MMM')}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{format(slot.date, 'HH:mm')}</span>
                      {slot.score >= 3 && (
                        <Badge variant="secondary" className="text-xs h-4 px-1.5">
                          <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                          Top
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{slot.reason}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {slot.platforms.slice(0, 4).map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: PLATFORM_COLORS[p] ?? '#6b7280' }}
                        >
                          {PLATFORM_LABELS[p] ?? p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 gap-1 ml-2" onClick={() => handleSchedule(slot)}>
                  <Plus className="w-3.5 h-3.5" />
                  Use
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
