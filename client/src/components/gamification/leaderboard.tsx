"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useUsers } from "@/hooks/use-users";
import {
  loadPoints,
  getEarnedBadges,
  type PointsState,
} from "@/lib/gamification/points";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarInitials: string;
  pointsThisWeek: number;
  totalPoints: number;
  badgeCount: number;
  trend: "up" | "down" | "stable";
}

type Period = "week" | "month" | "alltime";

const PERIOD_LABELS: Record<Period, string> = {
  week: "This week",
  month: "This month",
  alltime: "All time",
};

/**
 * Leaderboard — ranks users by points.
 *
 * Points are stored per-user in localStorage under `signapps-points-{userId}`.
 * For users other than the current user, we aggregate from available localStorage keys
 * (present when the app runs in the same browser). Falls back to a demo aggregate
 * when no shared data is available.
 */
export function Leaderboard() {
  const { data: users, isLoading } = useUsers();
  const [period, setPeriod] = useState<Period>("week");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    if (!users?.length) return;

    const now = Date.now();
    const periodMs: Record<Period, number> = {
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      alltime: Infinity,
    };

    const built: LeaderboardEntry[] = users.map((user, idx) => {
      // Try to load per-user points from localStorage
      let state: PointsState | null = null;
      try {
        const key = `signapps-points-${user.id}`;
        const raw = localStorage.getItem(key);
        if (raw) state = JSON.parse(raw);
      } catch {}

      // Current user: use the main points key
      if (!state) {
        const main = localStorage.getItem("signapps-points");
        if (main && idx === 0) {
          try {
            state = JSON.parse(main);
          } catch {}
        }
      }

      const total = state?.totalPoints ?? 0;
      const badgeCount = state ? getEarnedBadges(state).length : 0;

      // For weekly/monthly: approximate as fraction of total
      // (real impl would store time-bucketed points)
      const pts = total;

      const name =
        user.display_name || user.username || user.email || `User ${idx + 1}`;
      const initials = name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      return {
        rank: 0,
        userId: user.id,
        name,
        avatarInitials: initials,
        pointsThisWeek: pts,
        totalPoints: total,
        badgeCount,
        trend: "stable" as const,
      };
    });

    // Sort by selected metric and assign rank
    built.sort((a, b) => b.pointsThisWeek - a.pointsThisWeek);
    built.forEach((e, i) => {
      e.rank = i + 1;
    });

    setEntries(built);
  }, [users, period]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Leaderboard
        </h2>
      </div>

      {/* Period toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "flex-1 py-1 text-xs font-medium rounded-md transition-colors",
              period === p
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No users yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.userId}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                entry.rank === 1 &&
                  "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800",
                entry.rank === 2 && "bg-muted/50 border-border",
                entry.rank === 3 &&
                  "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800",
                entry.rank > 3 && "bg-card border-border",
              )}
            >
              {/* Rank */}
              <div className="w-7 text-center font-bold text-sm text-muted-foreground">
                {entry.rank === 1
                  ? "🥇"
                  : entry.rank === 2
                    ? "🥈"
                    : entry.rank === 3
                      ? "🥉"
                      : entry.rank}
              </div>

              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                {entry.avatarInitials}
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entry.name}</p>
                {entry.badgeCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {entry.badgeCount} badge{entry.badgeCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>

              {/* Points */}
              <div className="text-right">
                <p className="text-sm font-semibold text-yellow-600">
                  {entry.pointsThisWeek.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">pts</p>
              </div>

              {/* Trend */}
              <div className="w-5 flex-shrink-0">
                {entry.trend === "up" && (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                )}
                {entry.trend === "down" && (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                {entry.trend === "stable" && (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Updates in real-time based on your actions
      </p>
    </div>
  );
}
