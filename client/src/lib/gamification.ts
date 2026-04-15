/**
 * Gamification engine — XP, badges, streaks
 */

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  badges: Badge[];
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  unlockedAt: string;
}

const XP_PER_LEVEL = 100;

const XP_ACTIONS: Record<string, number> = {
  "task.complete": 10,
  "document.create": 15,
  "email.send": 5,
  "meeting.attend": 20,
  "review.submit": 25,
  "login.daily": 5,
};

export function addXp(stats: UserStats, action: string): UserStats {
  const xp = stats.xp + (XP_ACTIONS[action] || 5);
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  return { ...stats, xp, level };
}

export function checkBadges(stats: UserStats): Badge[] {
  const newBadges: Badge[] = [];
  const has = (id: string) => stats.badges.some((b) => b.id === id);

  if (stats.streak >= 7 && !has("streak-7"))
    newBadges.push({
      id: "streak-7",
      name: "Semaine parfaite",
      icon: "🔥",
      unlockedAt: new Date().toISOString(),
    });
  if (stats.streak >= 30 && !has("streak-30"))
    newBadges.push({
      id: "streak-30",
      name: "Mois consecutif",
      icon: "⚡",
      unlockedAt: new Date().toISOString(),
    });
  if (stats.level >= 5 && !has("level-5"))
    newBadges.push({
      id: "level-5",
      name: "Expert",
      icon: "🏆",
      unlockedAt: new Date().toISOString(),
    });
  if (stats.level >= 10 && !has("level-10"))
    newBadges.push({
      id: "level-10",
      name: "Maitre",
      icon: "👑",
      unlockedAt: new Date().toISOString(),
    });

  return newBadges;
}

export function getProgressToNextLevel(stats: UserStats): number {
  return (stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL;
}
