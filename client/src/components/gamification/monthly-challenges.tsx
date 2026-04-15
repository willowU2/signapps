"use client";

import { useEffect, useState } from "react";
import { Target, Users, Calendar } from "lucide-react";

interface Challenge {
  id: string;
  name: string;
  description: string;
  progress: number;
  maxProgress: number;
  deadline: Date;
  participants: number;
}

export default function MonthlyChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([
    {
      id: "1",
      name: "Code Quality Sprint",
      description: "Maintain 95% test coverage",
      progress: 92,
      maxProgress: 95,
      deadline: new Date(Date.now() + 8 * 24 * 3600000),
      participants: 34,
    },
    {
      id: "2",
      name: "Documentation Drive",
      description: "Complete API documentation",
      progress: 67,
      maxProgress: 100,
      deadline: new Date(Date.now() + 10 * 24 * 3600000),
      participants: 28,
    },
    {
      id: "3",
      name: "Performance Optimization",
      description: "Reduce load time by 20%",
      progress: 45,
      maxProgress: 100,
      deadline: new Date(Date.now() + 15 * 24 * 3600000),
      participants: 19,
    },
    {
      id: "4",
      name: "Community Support",
      description: "Answer 50 user questions",
      progress: 32,
      maxProgress: 50,
      deadline: new Date(Date.now() + 5 * 24 * 3600000),
      participants: 41,
    },
  ]);

  const formatDeadline = (date: Date) => {
    const now = new Date();
    const daysLeft = Math.ceil(
      (date.getTime() - now.getTime()) / (24 * 3600000),
    );
    return `${daysLeft} days left`;
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 60) return "bg-blue-500";
    if (progress >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Target className="w-6 h-6" />
          Monthly Challenges
        </h2>
        <span className="text-sm text-muted-foreground">March 2026</span>
      </div>

      <div className="space-y-3">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="p-4 border rounded-lg hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg">{challenge.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {challenge.description}
                </p>
              </div>
              <span className="text-xs bg-muted px-2 py-1 rounded font-medium">
                {challenge.progress}/{challenge.maxProgress}
              </span>
            </div>

            <div className="mb-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`${getProgressColor(challenge.progress)} h-2 rounded-full transition-all`}
                  style={{ width: `${challenge.progress}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDeadline(challenge.deadline)}
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {challenge.participants} participants
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-all">
        View All Challenges
      </button>
    </div>
  );
}
