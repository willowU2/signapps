'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, TrendingUp, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getClient, ServiceName } from '@/lib/api/factory';
import { addXp, getProgressToNextLevel, type UserStats } from '@/lib/gamification';

const client = () => getClient(ServiceName.IDENTITY);
const STORAGE_KEY = 'signapps-xp-stats';

const XP_ACTIONS: Record<string, { label: string; xp: number; icon: string }> = {
  'document.create': { label: 'Document créé', xp: 15, icon: '📄' },
  'email.send': { label: 'Email envoyé', xp: 5, icon: '✉️' },
  'meeting.attend': { label: 'Réunion', xp: 20, icon: '📅' },
  'task.complete': { label: 'Tâche terminée', xp: 10, icon: '✅' },
  'review.submit': { label: 'Revue soumise', xp: 25, icon: '🔍' },
  'login.daily': { label: 'Connexion quotidienne', xp: 5, icon: '🌟' },
  'file.upload': { label: 'Fichier uploadé', xp: 5, icon: '📁' },
  'comment.create': { label: 'Commentaire', xp: 3, icon: '💬' },
};

function getLevelTitle(level: number) {
  if (level < 3) return 'Débutant';
  if (level < 7) return 'Apprenti';
  if (level < 12) return 'Confirmé';
  if (level < 20) return 'Expert';
  return 'Maître';
}

function getLevelColor(level: number) {
  if (level < 3) return 'text-green-600';
  if (level < 7) return 'text-blue-600';
  if (level < 12) return 'text-purple-600';
  if (level < 20) return 'text-orange-600';
  return 'text-yellow-600';
}

function loadStats(): UserStats {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { xp: 0, level: 1, streak: 0, badges: [] };
  } catch { return { xp: 0, level: 1, streak: 0, badges: [] }; }
}

export function awardXp(action: string) {
  const stats = loadStats();
  const updated = addXp(stats, action);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('xpEarned', { detail: { action, stats: updated } }));
  return updated;
}

interface XpToast { action: string; xp: number }

export function XpSystemFull() {
  const [stats, setStats] = useState<UserStats>(loadStats);
  const [recentToasts, setRecentToasts] = useState<XpToast[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await client().get<UserStats>('/gamification/stats');
      setStats(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      setStats(loadStats());
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = (e: Event) => {
      const { action, stats: updated } = (e as CustomEvent).detail;
      setStats(updated);
      const xpDef = XP_ACTIONS[action];
      if (xpDef) {
        const toast: XpToast = { action: xpDef.label, xp: xpDef.xp };
        setRecentToasts(prev => [toast, ...prev].slice(0, 5));
        setTimeout(() => setRecentToasts(prev => prev.filter(t => t !== toast)), 3000);
      }
    };
    window.addEventListener('xpEarned', handler);
    return () => window.removeEventListener('xpEarned', handler);
  }, [refresh]);

  const progress = getProgressToNextLevel(stats) * 100;
  const XP_PER_LEVEL = 100;
  const xpInLevel = stats.xp % XP_PER_LEVEL;
  const levelTitle = getLevelTitle(stats.level);
  const levelColor = getLevelColor(stats.level);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Expérience
        </h2>
        <Badge variant="outline" className={`font-medium ${levelColor}`}>
          {levelTitle}
        </Badge>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-sm text-muted-foreground">Niveau</p>
            <p className={`text-5xl font-bold ${levelColor}`}>{stats.level}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">XP Total</p>
            <p className="text-2xl font-bold">{stats.xp.toLocaleString()}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progression niveau {stats.level + 1}</span>
            <span>{xpInLevel} / {XP_PER_LEVEL} XP</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      <div>
        <h3 className="font-medium text-sm mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" />
          Actions XP disponibles
        </h3>
        <ScrollArea className="h-48">
          <div className="space-y-1 pr-2">
            {Object.entries(XP_ACTIONS).map(([key, def]) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span>{def.icon}</span>
                  <span className="text-sm">{def.label}</span>
                </div>
                <Badge variant="secondary" className="text-xs font-mono">+{def.xp} XP</Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Floating XP gain toasts */}
      <div className="fixed bottom-20 right-4 z-50 space-y-1 pointer-events-none">
        {recentToasts.map((t, i) => (
          <div key={i} className="flex items-center gap-2 bg-card border rounded-lg shadow-lg px-3 py-2 animate-in slide-in-from-right-4">
            <Star className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-sm">{t.action}</span>
            <span className="text-sm font-bold text-yellow-600">+{t.xp} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}
