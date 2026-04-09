"use client";

import { useState, useEffect } from "react";
import { Flame, Calendar, TrendingUp, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gamificationApi } from "@/lib/api/gamification";

interface StreakData {
  current: number;
  longest: number;
  lastActive: string;
  weekDays: boolean[];
  monthActivity: boolean[];
}

function defaultStreak(): StreakData {
  return {
    current: 0,
    longest: 0,
    lastActive: "",
    weekDays: Array(7).fill(false),
    monthActivity: Array(30).fill(false),
  };
}

export function ProductivityStreaks() {
  const [streak, setStreak] = useState<StreakData>(defaultStreak);

  useEffect(() => {
    gamificationApi
      .getStreak()
      .then((data) => {
        setStreak({
          current: data.current,
          longest: data.longest,
          lastActive: data.last_active,
          weekDays: Array(7)
            .fill(false)
            .map((_, i) => i >= 7 - data.current),
          monthActivity: Array(30)
            .fill(false)
            .map((_, i) => i >= 30 - data.current),
        });
      })
      .catch(() => {});
  }, []);

  const days = ["L", "M", "M", "J", "V", "S", "D"];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Streak de productivité
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div
          className={`p-4 rounded-xl border-2 text-center transition-all ${
            streak.current > 0
              ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20"
              : "border-border bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame
              className={`w-5 h-5 ${streak.current > 0 ? "text-orange-500" : "text-muted-foreground"}`}
            />
            <p className="text-4xl font-bold">{streak.current}</p>
          </div>
          <p className="text-xs text-muted-foreground">Streak actuel</p>
          <p className="text-xs font-medium">
            {streak.current === 0
              ? "Connectez-vous !"
              : streak.current === 1
                ? "1 jour"
                : `${streak.current} jours`}
          </p>
        </div>

        <div className="p-4 rounded-xl border-2 border-border bg-muted/30 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Award className="w-5 h-5 text-yellow-500" />
            <p className="text-4xl font-bold">{streak.longest}</p>
          </div>
          <p className="text-xs text-muted-foreground">Record</p>
          <p className="text-xs font-medium">meilleur streak</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> Cette semaine
        </p>
        <div className="flex gap-1.5">
          {days.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full aspect-square rounded-md transition-colors ${
                  streak.weekDays[i] ? "bg-orange-400" : "bg-muted"
                }`}
              />
              <span className="text-xs text-muted-foreground">{day}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" /> Activité du mois
        </p>
        <div className="grid grid-cols-10 gap-1">
          {streak.monthActivity.map((active, i) => (
            <div
              key={i}
              className={`aspect-square rounded-sm transition-colors ${active ? "bg-orange-400" : "bg-muted"}`}
              title={`Jour ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {streak.current >= 7 && (
        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 text-center">
          <p className="text-sm font-medium text-orange-700">
            🔥 Impressionnant ! {streak.current} jours de suite !
          </p>
        </div>
      )}
    </div>
  );
}
