"use client";

import { useEffect, useState } from "react";
import { Zap, TrendingUp } from "lucide-react";

interface XpGain {
  id: string;
  action: string;
  xp: number;
  timestamp: Date;
}

export default function XpSystem() {
  const [currentLevel, setCurrentLevel] = useState(5);
  const [currentXp, setCurrentXp] = useState(2450);
  const [xpToNextLevel] = useState(5000);
  const [recentGains, setRecentGains] = useState<XpGain[]>([
    { id: "1", action: "Completed task", xp: 250, timestamp: new Date(Date.now() - 5 * 60000) },
    { id: "2", action: "Helped teammate", xp: 100, timestamp: new Date(Date.now() - 15 * 60000) },
    { id: "3", action: "Code review", xp: 150, timestamp: new Date(Date.now() - 30 * 60000) },
    { id: "4", action: "Bug fix", xp: 200, timestamp: new Date(Date.now() - 60 * 60000) },
  ]);

  const progressPercentage = (currentXp / xpToNextLevel) * 100;

  const getLevelColor = (level: number) => {
    if (level < 3) return "bg-green-100 border-green-300";
    if (level < 7) return "bg-blue-100 border-blue-300";
    if (level < 12) return "bg-purple-100 border-purple-300";
    return "bg-orange-100 border-orange-300";
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Experience System</h2>
        <Zap className="w-6 h-6 text-yellow-500" />
      </div>

      <div className={`p-4 rounded-lg border-2 ${getLevelColor(currentLevel)}`}>
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-sm text-muted-foreground">Current Level</p>
            <p className="text-4xl font-bold">{currentLevel}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Experience</p>
            <p className="font-mono text-lg">{currentXp.toLocaleString()} XP</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Progress to Level {currentLevel + 1}</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {(xpToNextLevel - currentXp).toLocaleString()} XP needed
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Recent XP Gains
        </h3>
        <div className="space-y-2">
          {recentGains.map((gain) => (
            <div key={gain.id} className="flex justify-between items-center p-2 bg-muted rounded">
              <div>
                <p className="text-sm font-medium">{gain.action}</p>
                <p className="text-xs text-muted-foreground">{formatTime(gain.timestamp)}</p>
              </div>
              <p className="font-mono font-bold text-yellow-600">+{gain.xp} XP</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
