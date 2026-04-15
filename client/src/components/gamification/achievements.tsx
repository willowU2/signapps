"use client";

import { useEffect, useState } from "react";
import { Award, Lock } from "lucide-react";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  unlockedDate?: Date;
}

export default function Achievements() {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [badges, setBadges] = useState<Badge[]>([
    {
      id: "1",
      name: "Quick Learner",
      description: "Complete 5 tasks in a day",
      icon: "⚡",
      unlocked: true,
      progress: 5,
      maxProgress: 5,
      unlockedDate: new Date(Date.now() - 7 * 24 * 3600000),
    },
    {
      id: "2",
      name: "Team Player",
      description: "Help 10 teammates",
      icon: "🤝",
      unlocked: true,
      progress: 10,
      maxProgress: 10,
      unlockedDate: new Date(Date.now() - 3 * 24 * 3600000),
    },
    {
      id: "3",
      name: "Code Master",
      description: "Fix 20 bugs",
      icon: "🎯",
      unlocked: false,
      progress: 12,
      maxProgress: 20,
    },
    {
      id: "4",
      name: "Night Owl",
      description: "Work after midnight 5 times",
      icon: "🌙",
      unlocked: false,
      progress: 2,
      maxProgress: 5,
    },
    {
      id: "5",
      name: "Documentation Master",
      description: "Write 50 documentation entries",
      icon: "📚",
      unlocked: false,
      progress: 28,
      maxProgress: 50,
    },
    {
      id: "6",
      name: "Milestone: 100 XP",
      description: "Earn 100 experience points",
      icon: "🏆",
      unlocked: true,
      progress: 100,
      maxProgress: 100,
      unlockedDate: new Date(Date.now() - 30 * 24 * 3600000),
    },
  ]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Achievements</h2>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Unlocked</p>
          <p className="text-2xl font-bold">
            {unlockedCount}/{badges.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            onClick={() => setSelectedBadge(badge)}
            className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
              badge.unlocked
                ? "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300"
                : "bg-muted border-border opacity-75"
            } ${selectedBadge?.id === badge.id ? "ring-2 ring-blue-500" : ""}`}
          >
            <div className="text-center">
              <div className="text-3xl mb-1">{badge.icon}</div>
              <p className="text-xs font-medium line-clamp-2">{badge.name}</p>
              <div className="mt-2 bg-gray-200 rounded-full h-1">
                <div
                  className="bg-blue-600 h-1 rounded-full"
                  style={{
                    width: `${(badge.progress / badge.maxProgress) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {badge.progress}/{badge.maxProgress}
              </p>
            </div>
          </div>
        ))}
      </div>

      {selectedBadge && (
        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="text-4xl">{selectedBadge.icon}</div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">{selectedBadge.name}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {selectedBadge.description}
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Progress</span>
                  <span>
                    {selectedBadge.progress}/{selectedBadge.maxProgress}
                  </span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${(selectedBadge.progress / selectedBadge.maxProgress) * 100}%`,
                    }}
                  />
                </div>
              </div>
              {selectedBadge.unlocked && selectedBadge.unlockedDate && (
                <p className="text-xs text-muted-foreground mt-2">
                  Unlocked {selectedBadge.unlockedDate.toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
