/**
 * Gamification API client — XP, badges, streaks, leaderboards.
 *
 * All endpoints route through the gateway at /api/v1/gamification/*.
 */

import { getClient, ServiceName } from "./factory";

const client = () => getClient(ServiceName.GAMIFICATION_SVC);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserXp {
  id: string;
  user_id: string;
  total_xp: number;
  level: number;
  streak_days: number;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface XpEvent {
  id: string;
  user_id: string;
  action: string;
  xp_amount: number;
  source_module: string | null;
  source_id: string | null;
  created_at: string;
}

export interface GamificationBadge {
  id: string;
  user_id: string;
  badge_type: string;
  earned_at: string;
}

export interface LeaderEntry {
  rank: number;
  id: string;
  display_name: string;
  xp: number;
  level: number;
  streak: number;
  badges_count: number;
}

export interface StreakData {
  current: number;
  longest: number;
  last_active: string;
}

export interface AwardXpPayload {
  action: string;
  source_module?: string;
  source_id?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** Fetch the current user's XP profile. */
export async function getMyXp(): Promise<UserXp> {
  const { data } = await client().get<UserXp>("/gamification/xp");
  return data;
}

/** Award XP to the current user for a given action. */
export async function awardXp(payload: AwardXpPayload): Promise<UserXp> {
  const { data } = await client().post<UserXp>("/gamification/xp", payload);
  return data;
}

/** Fetch the current user's badges. */
export async function getMyBadges(): Promise<GamificationBadge[]> {
  const { data } = await client().get<GamificationBadge[]>(
    "/gamification/badges",
  );
  return data;
}

/** Fetch the current user's streak data. */
export async function getStreak(): Promise<StreakData> {
  const { data } = await client().get<StreakData>("/gamification/streak");
  return data;
}

/** Fetch the leaderboard. */
export async function getLeaderboard(
  period?: "weekly" | "monthly" | "alltime",
): Promise<LeaderEntry[]> {
  const { data } = await client().get<LeaderEntry[]>(
    "/gamification/leaderboard",
    { params: { period } },
  );
  return data;
}

export const gamificationApi = {
  getMyXp,
  awardXp,
  getMyBadges,
  getStreak,
  getLeaderboard,
};
