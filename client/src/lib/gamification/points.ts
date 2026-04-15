/**
 * Points & Badges engine (GA1)
 *
 * Tracks points and badges in localStorage.
 * Server-side rendering safe: all localStorage access is guarded.
 */

export const STORAGE_KEY = "signapps-points";

// ── Point values per action ──────────────────────────────────
export const POINT_VALUES: Record<string, number> = {
  "email.sent": 1,
  "task.completed": 5,
  "deal.closed": 50,
  "doc.created": 3,
  "calendar.event_created": 2,
  "contact.created": 2,
  "file.uploaded": 1,
  "meeting.attended": 10,
  "comment.created": 1,
  "login.daily": 2,
};

// ── Badge definitions ────────────────────────────────────────
export interface BadgeDef {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  /** Action key + threshold to unlock */
  trigger: { action: string; threshold: number };
}

export const BADGE_DEFINITIONS: BadgeDef[] = [
  {
    id: "email-master",
    name: "Maître des emails",
    nameEn: "Email Master",
    icon: "✉️",
    description: "Envoyer 100 emails",
    trigger: { action: "email.sent", threshold: 100 },
  },
  {
    id: "closer",
    name: "Closer",
    nameEn: "Closer",
    icon: "🤝",
    description: "Clôturer 10 deals",
    trigger: { action: "deal.closed", threshold: 10 },
  },
  {
    id: "organizer",
    name: "Organisateur",
    nameEn: "Organizer",
    icon: "📅",
    description: "Créer 50 événements",
    trigger: { action: "calendar.event_created", threshold: 50 },
  },
  {
    id: "task-crusher",
    name: "Briseur de tâches",
    nameEn: "Task Crusher",
    icon: "⚡",
    description: "Terminer 100 tâches",
    trigger: { action: "task.completed", threshold: 100 },
  },
  {
    id: "doc-wizard",
    name: "Magicien des docs",
    nameEn: "Doc Wizard",
    icon: "📄",
    description: "Créer 20 documents",
    trigger: { action: "doc.created", threshold: 20 },
  },
];

// ── Data types ───────────────────────────────────────────────
export interface EarnedBadge {
  id: string;
  unlockedAt: string;
}

export interface PointsState {
  totalPoints: number;
  /** Per-action cumulative counts */
  actionCounts: Record<string, number>;
  badges: EarnedBadge[];
  lastUpdated: string;
}

function defaultState(): PointsState {
  return {
    totalPoints: 0,
    actionCounts: {},
    badges: [],
    lastUpdated: new Date().toISOString(),
  };
}

// ── Persistence ──────────────────────────────────────────────
export function loadPoints(): PointsState {
  if (typeof window === "undefined") return defaultState();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultState();
    return JSON.parse(stored) as PointsState;
  } catch {
    return defaultState();
  }
}

function savePoints(state: PointsState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

// ── Core API ─────────────────────────────────────────────────

/**
 * Award points for an action. Returns the updated state and any newly unlocked badges.
 */
export function awardPoints(
  action: string,
  count = 1,
): { state: PointsState; newBadges: BadgeDef[] } {
  const pts = (POINT_VALUES[action] ?? 1) * count;
  const prev = loadPoints();

  const actionCounts = {
    ...prev.actionCounts,
    [action]: (prev.actionCounts[action] ?? 0) + count,
  };

  // Detect newly unlocked badges
  const newBadges: BadgeDef[] = [];
  for (const def of BADGE_DEFINITIONS) {
    if (def.trigger.action !== action) continue;
    const alreadyOwned = prev.badges.some((b) => b.id === def.id);
    if (alreadyOwned) continue;
    if (actionCounts[action] >= def.trigger.threshold) {
      newBadges.push(def);
    }
  }

  const earnedBadges: EarnedBadge[] = [
    ...prev.badges,
    ...newBadges.map((b) => ({
      id: b.id,
      unlockedAt: new Date().toISOString(),
    })),
  ];

  const next: PointsState = {
    totalPoints: prev.totalPoints + pts,
    actionCounts,
    badges: earnedBadges,
    lastUpdated: new Date().toISOString(),
  };

  savePoints(next);
  return { state: next, newBadges };
}

/**
 * Get all unlocked badge definitions (resolved from IDs).
 */
export function getEarnedBadges(
  state: PointsState,
): (BadgeDef & { unlockedAt: string })[] {
  return state.badges
    .map((earned) => {
      const def = BADGE_DEFINITIONS.find((b) => b.id === earned.id);
      if (!def) return null;
      return { ...def, unlockedAt: earned.unlockedAt };
    })
    .filter(Boolean) as (BadgeDef & { unlockedAt: string })[];
}

/**
 * Progress toward a badge (0–1).
 */
export function getBadgeProgress(state: PointsState, badgeId: string): number {
  const def = BADGE_DEFINITIONS.find((b) => b.id === badgeId);
  if (!def) return 0;
  const count = state.actionCounts[def.trigger.action] ?? 0;
  return Math.min(count / def.trigger.threshold, 1);
}
