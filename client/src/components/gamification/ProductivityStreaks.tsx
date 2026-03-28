'use client';

import { useState, useEffect } from 'react';
import { Flame, Calendar, TrendingUp, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClient, ServiceName } from '@/lib/api/factory';

const client = () => getClient(ServiceName.IDENTITY);
const STORAGE_KEY = 'signapps-streak';

interface StreakData {
  current: number;
  longest: number;
  lastActive: string;
  weekDays: boolean[]; // last 7 days active?
  monthActivity: boolean[]; // last 30 days
}

function loadStreak(): StreakData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { current: 0, longest: 0, lastActive: '', weekDays: Array(7).fill(false), monthActivity: Array(30).fill(false) };
    return JSON.parse(stored);
  } catch {
    return { current: 0, longest: 0, lastActive: '', weekDays: Array(7).fill(false), monthActivity: Array(30).fill(false) };
  }
}

export function updateStreak() {
  const data = loadStreak();
  const today = new Date().toDateString();
  if (data.lastActive === today) return data; // already counted today

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const current = data.lastActive === yesterday ? data.current + 1 : 1;
  const longest = Math.max(data.longest, current);

  const weekDays = [...data.weekDays.slice(1), true];
  const monthActivity = [...data.monthActivity.slice(1), true];

  const updated: StreakData = { current, longest, lastActive: today, weekDays, monthActivity };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function ProductivityStreaks() {
  const [streak, setStreak] = useState<StreakData>(loadStreak);

  useEffect(() => {
    // Update streak on mount (daily login)
    const updated = updateStreak();
    setStreak(updated);

    // Also try fetching from API
    client().get<StreakData>('/gamification/streak')
      .then(({ data }) => { setStreak(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); })
      .catch(() => {});
  }, []);

  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Streak de productivité
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`p-4 rounded-xl border-2 text-center transition-all ${
          streak.current > 0 ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/20' : 'border-border bg-muted/30'
        }`}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame className={`w-5 h-5 ${streak.current > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            <p className="text-4xl font-bold">{streak.current}</p>
          </div>
          <p className="text-xs text-muted-foreground">Streak actuel</p>
          <p className="text-xs font-medium">
            {streak.current === 0 ? 'Connectez-vous !' : streak.current === 1 ? '1 jour' : `${streak.current} jours`}
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
              <div className={`w-full aspect-square rounded-md transition-colors ${
                streak.weekDays[i] ? 'bg-orange-400' : 'bg-muted'
              }`} />
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
              className={`aspect-square rounded-sm transition-colors ${active ? 'bg-orange-400' : 'bg-muted'}`}
              title={`Jour ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {streak.current >= 7 && (
        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 text-center">
          <p className="text-sm font-medium text-orange-700">🔥 Impressionnant ! {streak.current} jours de suite !</p>
        </div>
      )}
    </div>
  );
}
