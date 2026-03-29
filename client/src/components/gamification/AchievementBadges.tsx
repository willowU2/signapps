'use client';

import { useState, useEffect, useCallback } from 'react';
import { Award, Lock, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { getClient, ServiceName } from '@/lib/api/factory';
import type { Badge as GBadge } from '@/lib/gamification';

const client = () => getClient(ServiceName.IDENTITY);

interface FullBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  unlockedAt?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const BUILTIN_BADGES: FullBadge[] = [
  { id: 'first_login', name: 'Bienvenue', description: 'Première connexion', icon: '👋', category: 'Démarrage', unlocked: true, progress: 1, maxProgress: 1, rarity: 'common', unlockedAt: new Date().toISOString() },
  { id: 'streak_7', name: 'Semaine parfaite', description: 'Connecté 7 jours de suite', icon: '🔥', category: 'Assiduité', unlocked: false, progress: 3, maxProgress: 7, rarity: 'rare' },
  { id: 'streak_30', name: 'Mois consécutif', description: 'Connecté 30 jours de suite', icon: '⚡', category: 'Assiduité', unlocked: false, progress: 3, maxProgress: 30, rarity: 'epic' },
  { id: 'level_5', name: 'Expert', description: 'Atteindre le niveau 5', icon: '🏆', category: 'Progression', unlocked: false, progress: 1, maxProgress: 5, rarity: 'rare' },
  { id: 'level_10', name: 'Maître', description: 'Atteindre le niveau 10', icon: '👑', category: 'Progression', unlocked: false, progress: 1, maxProgress: 10, rarity: 'legendary' },
  { id: 'docs_10', name: 'Auteur', description: 'Créer 10 documents', icon: '✍️', category: 'Documents', unlocked: false, progress: 4, maxProgress: 10, rarity: 'common' },
  { id: 'mail_50', name: 'Correspondant', description: 'Envoyer 50 emails', icon: '📬', category: 'Communication', unlocked: false, progress: 12, maxProgress: 50, rarity: 'common' },
  { id: 'task_master', name: 'Efficace', description: 'Compléter 20 tâches', icon: '✅', category: 'Productivité', unlocked: false, progress: 7, maxProgress: 20, rarity: 'rare' },
  { id: 'collaborator', name: 'Collaborateur', description: 'Partager 5 documents', icon: '🤝', category: 'Collaboration', unlocked: false, progress: 2, maxProgress: 5, rarity: 'common' },
];

const RARITY_COLORS: Record<string, string> = {
  common: 'bg-muted border-border',
  rare: 'bg-blue-50 border-blue-300',
  epic: 'bg-purple-50 border-purple-300',
  legendary: 'bg-yellow-50 border-yellow-400',
};

const RARITY_LABELS: Record<string, string> = {
  common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire',
};

interface Props { filter?: string }

export function AchievementBadges({ filter }: Props) {
  const [badges, setBadges] = useState<FullBadge[]>(BUILTIN_BADGES);
  const [selected, setSelected] = useState<FullBadge | null>(null);
  const [activeFilter, setActiveFilter] = useState(filter || 'all');

  useEffect(() => {
    client().get<FullBadge[]>('/gamification/badges')
      .then(({ data }) => setBadges(data))
      .catch(() => setBadges(BUILTIN_BADGES));
  }, []);

  const unlocked = badges.filter(b => b.unlocked);
  const categories = ['all', ...new Set(badges.map(b => b.category))];
  const shown = activeFilter === 'all' ? badges : badges.filter(b => b.category === activeFilter);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" />
          Badges
        </h2>
        <div className="text-right">
          <p className="text-2xl font-bold">{unlocked.length}<span className="text-muted-foreground text-sm">/{badges.length}</span></p>
          <p className="text-xs text-muted-foreground">débloqués</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeFilter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat === 'all' ? 'Tous' : cat}
          </button>
        ))}
      </div>

      <ScrollArea className="h-80">
        <div className="grid grid-cols-3 gap-2 pr-2">
          {shown.map(b => (
            <button
              key={b.id}
              onClick={() => setSelected(selected?.id === b.id ? null : b)}
              className={`relative p-2 rounded-xl border-2 transition-all hover:shadow-md text-center ${
                RARITY_COLORS[b.rarity]
              } ${!b.unlocked ? 'opacity-60' : ''} ${selected?.id === b.id ? 'ring-2 ring-primary' : ''}`}
            >
              <div className={`text-2xl mb-1 ${!b.unlocked ? 'grayscale opacity-50' : ''}`}>{b.icon}</div>
              <p className="text-xs font-medium leading-tight line-clamp-2">{b.name}</p>
              {b.unlocked ? (
                <div className="absolute top-1 right-1">
                  <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                </div>
              ) : (
                <div className="mt-1">
                  <div className="w-full bg-border rounded-full h-1">
                    <div className="bg-primary h-1 rounded-full" style={{ width: `${(b.progress / b.maxProgress) * 100}%` }} />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>

      {selected && (
        <div className={`p-3 rounded-xl border-2 space-y-2 ${RARITY_COLORS[selected.rarity]}`}>
          <div className="flex items-start gap-3">
            <div className="text-3xl">{selected.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{selected.name}</h3>
                <Badge variant="outline" className="text-xs">{RARITY_LABELS[selected.rarity]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{selected.description}</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Progression</span>
                  <span>{selected.progress}/{selected.maxProgress}</span>
                </div>
                <Progress value={(selected.progress / selected.maxProgress) * 100} className="h-1.5" />
              </div>
              {selected.unlocked && selected.unlockedAt && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Débloqué le {new Date(selected.unlockedAt).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
