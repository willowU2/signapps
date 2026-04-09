"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  gamificationApi,
  type LeaderEntry as ApiLeaderEntry,
} from "@/lib/api/gamification";

interface LeaderEntry {
  rank: number;
  id: string;
  display_name: string;
  avatar?: string;
  xp: number;
  level: number;
  streak: number;
  badges_count: number;
  trend: "up" | "down" | "stable";
  trend_value: number;
  is_current_user?: boolean;
}

type Period = "weekly" | "monthly" | "alltime";

const PERIOD_LABELS: Record<Period, string> = {
  weekly: "Cette semaine",
  monthly: "Ce mois",
  alltime: "Tout temps",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MOCK_ENTRIES: LeaderEntry[] = [
  {
    rank: 1,
    id: "1",
    display_name: "Alice Martin",
    xp: 8450,
    level: 12,
    streak: 15,
    badges_count: 8,
    trend: "up",
    trend_value: 2,
  },
  {
    rank: 2,
    id: "2",
    display_name: "Bob Dupont",
    xp: 7230,
    level: 10,
    streak: 7,
    badges_count: 6,
    trend: "down",
    trend_value: 1,
  },
  {
    rank: 3,
    id: "3",
    display_name: "Claire Moreau",
    xp: 6890,
    level: 9,
    streak: 12,
    badges_count: 7,
    trend: "up",
    trend_value: 1,
  },
  {
    rank: 4,
    id: "4",
    display_name: "David Petit",
    xp: 5450,
    level: 8,
    streak: 3,
    badges_count: 4,
    trend: "stable",
    trend_value: 0,
  },
  {
    rank: 5,
    id: "5",
    display_name: "Emma Rousseau",
    xp: 4980,
    level: 7,
    streak: 5,
    badges_count: 5,
    trend: "up",
    trend_value: 3,
  },
];

export function TeamLeaderboardFull() {
  const [period, setPeriod] = useState<Period>("weekly");
  const [entries, setEntries] = useState<LeaderEntry[]>(MOCK_ENTRIES);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gamificationApi.getLeaderboard(period);
      const mapped: LeaderEntry[] = data.map((e) => ({
        rank: e.rank,
        id: e.id,
        display_name: e.display_name,
        xp: e.xp,
        level: e.level,
        streak: e.streak,
        badges_count: e.badges_count,
        trend: "stable" as const,
        trend_value: 0,
      }));
      setEntries(mapped.length > 0 ? mapped : MOCK_ENTRIES);
    } catch {
      setEntries(MOCK_ENTRIES);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = showAll ? entries : entries.slice(0, 10);

  const currentUser = entries.find((e) => e.is_current_user);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Classement
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={load}
          disabled={loading}
          className="h-7 px-2"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      <div className="flex gap-1">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              period === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      <div className="flex items-end justify-center gap-2 h-24 mb-2">
        {[entries[1], entries[0], entries[2]].map((e, i) => {
          if (!e) return null;
          const heights = ["h-16", "h-24", "h-12"];
          const medals = ["🥈", "🥇", "🥉"];
          return (
            <div
              key={e.id}
              className={`flex-1 flex flex-col items-center justify-end ${heights[i]} bg-muted/50 rounded-t-lg border-t-2 ${i === 1 ? "border-yellow-400" : "border-border"}`}
            >
              <span className="text-lg">{medals[i]}</span>
              <p className="text-xs font-medium truncate px-1 max-w-full">
                {e.display_name.split(" ")[0]}
              </p>
              <p className="text-xs text-muted-foreground">
                {e.xp.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      <ScrollArea className="h-64">
        <div className="space-y-1 pr-2">
          {shown.map((e) => (
            <div
              key={e.id}
              className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors ${
                e.is_current_user
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="w-6 text-center text-sm font-bold text-muted-foreground">
                {e.rank <= 3 ? ["🥇", "🥈", "🥉"][e.rank - 1] : e.rank}
              </div>
              <Avatar className="w-7 h-7">
                <AvatarFallback className="text-xs bg-primary/20">
                  {initials(e.display_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${e.is_current_user ? "text-primary" : ""}`}
                >
                  {e.display_name}
                  {e.is_current_user && (
                    <span className="text-xs ml-1">(vous)</span>
                  )}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Niv. {e.level}</span>
                  <span>·</span>
                  <span>🔥 {e.streak}j</span>
                  <span>·</span>
                  <span>🏅 {e.badges_count}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-bold">
                  {e.xp.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">XP</span>
                {e.trend === "up" && (
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                )}
                {e.trend === "down" && (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                )}
                {e.trend === "stable" && (
                  <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {entries.length > 10 && (
        <div className="flex items-center justify-between">
          <Label htmlFor="show-all" className="text-sm">
            Tout afficher ({entries.length})
          </Label>
          <Switch
            id="show-all"
            checked={showAll}
            onCheckedChange={setShowAll}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Mis à jour quotidiennement · Reset{" "}
        {period === "weekly"
          ? "chaque lundi"
          : period === "monthly"
            ? "chaque 1er du mois"
            : "jamais"}
      </p>
    </div>
  );
}
