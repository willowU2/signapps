'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  loadPoints,
  getEarnedBadges,
  getBadgeProgress,
  BADGE_DEFINITIONS,
  type PointsState,
} from '@/lib/gamification/points';
import { cn } from '@/lib/utils';

/**
 * PointsDisplay — small star icon in the header that opens a popover
 * showing the user's total points and earned badges.
 */
export function PointsDisplay() {
  const [pts, setPts] = useState<PointsState | null>(null);

  useEffect(() => {
    setPts(loadPoints());

    // Refresh whenever localStorage changes (other tabs / awardPoints calls)
    const handler = (e: StorageEvent) => {
      if (e.key === 'signapps-points') setPts(loadPoints());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  if (!pts) return null;

  const earned = getEarnedBadges(pts);
  const unearned = BADGE_DEFINITIONS.filter((b) => !earned.some((e) => e.id === b.id));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${pts.totalPoints} points`}
          title="Your points & badges"
        >
          <Star className="h-4 w-4 text-yellow-500" aria-hidden="true" />
          {pts.totalPoints > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-yellow-500 text-white text-[9px] font-bold flex items-center justify-center">
              {pts.totalPoints > 9999 ? '9k+' : pts.totalPoints}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-sm font-semibold">Your Points</p>
            <p className="text-2xl font-bold text-yellow-500">
              {pts.totalPoints.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">pts</span>
            </p>
          </div>
          <Star className="h-8 w-8 text-yellow-400" />
        </div>

        {/* Earned badges */}
        {earned.length > 0 && (
          <div className="px-4 py-3 border-b">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Badges earned ({earned.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {earned.map((b) => (
                <span
                  key={b.id}
                  title={`${b.name} — ${new Date(b.unlockedAt).toLocaleDateString()}`}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium border border-yellow-200"
                >
                  <span>{b.icon}</span>
                  <span>{b.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Badges in progress */}
        {unearned.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              In progress
            </p>
            <div className="space-y-2">
              {unearned.slice(0, 3).map((b) => {
                const progress = getBadgeProgress(pts, b.id);
                const count = pts.actionCounts[b.trigger.action] ?? 0;
                return (
                  <div key={b.id} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span>{b.icon}</span>
                        <span className="font-medium">{b.name}</span>
                      </span>
                      <span className="text-muted-foreground">
                        {count}/{b.trigger.threshold}
                      </span>
                    </div>
                    <Progress value={progress * 100} className={cn('h-1.5')} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {earned.length === 0 && unearned.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Complete actions to earn points and badges!
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
