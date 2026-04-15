"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, TrendingDown } from "lucide-react";

interface TeamEntry {
  position: number;
  name: string;
  score: number;
  trend: "up" | "down" | "stable";
  trendValue: number;
  avatar: string;
}

export default function TeamLeaderboard() {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "alltime">(
    "weekly",
  );
  const [teams, setTeams] = useState<TeamEntry[]>([
    {
      position: 1,
      name: "Frontend Squad",
      score: 8450,
      trend: "up",
      trendValue: 3,
      avatar: "🚀",
    },
    {
      position: 2,
      name: "Backend Builders",
      score: 8230,
      trend: "down",
      trendValue: 1,
      avatar: "⚙️",
    },
    {
      position: 3,
      name: "DevOps Dragons",
      score: 7890,
      trend: "up",
      trendValue: 2,
      avatar: "🐉",
    },
    {
      position: 4,
      name: "QA Warriors",
      score: 7450,
      trend: "stable",
      trendValue: 0,
      avatar: "⚔️",
    },
    {
      position: 5,
      name: "Design Ninjas",
      score: 6980,
      trend: "up",
      trendValue: 1,
      avatar: "🥷",
    },
  ]);

  const periodLabels = {
    weekly: "This Week",
    monthly: "This Month",
    alltime: "All Time",
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          Team Leaderboard
        </h2>
      </div>

      <div className="flex gap-2">
        {(["weekly", "monthly", "alltime"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              period === p
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-muted-foreground hover:bg-gray-300"
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {teams.map((team) => (
          <div
            key={team.position}
            className={`p-3 rounded-lg border-l-4 transition-all hover:shadow-md ${
              team.position === 1
                ? "bg-yellow-50 border-yellow-400"
                : team.position === 2
                  ? "bg-muted border-gray-400"
                  : team.position === 3
                    ? "bg-orange-50 border-orange-400"
                    : "bg-card border-blue-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="text-2xl font-bold text-muted-foreground w-8">
                  {team.position === 1
                    ? "🥇"
                    : team.position === 2
                      ? "🥈"
                      : team.position === 3
                        ? "🥉"
                        : team.position}
                </div>
                <div className="text-2xl">{team.avatar}</div>
                <div>
                  <p className="font-medium">{team.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {team.score.toLocaleString()} points
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {team.trend === "up" && (
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      +{team.trendValue}
                    </span>
                  </div>
                )}
                {team.trend === "down" && (
                  <div className="flex items-center gap-1 text-red-600">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      -{team.trendValue}
                    </span>
                  </div>
                )}
                {team.trend === "stable" && (
                  <div className="text-sm font-medium text-muted-foreground">
                    −
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-blue-50 rounded-lg text-sm border border-blue-200">
        <p className="font-medium">Leaderboard updates daily at 12:00 AM UTC</p>
      </div>
    </div>
  );
}
