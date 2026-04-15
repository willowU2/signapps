"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, Target, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeamMember {
  id: string;
  name: string;
  steps: number;
  km: number;
  rank: number;
}

interface Challenge {
  id: string;
  name: string;
  unit: "steps" | "km";
  target: number;
  deadline: string;
}

export default function SportChallenge() {
  const [personalSteps, setPersonalSteps] = useState(4250);
  const [personalKm, setPersonalKm] = useState(5.3);
  const [selectedChallenge, setSelectedChallenge] = useState("daily");

  const teamMembers: TeamMember[] = [
    { id: "1", name: "Alex", steps: 8500, km: 10.2, rank: 1 },
    { id: "2", name: "Jordan", steps: 7200, km: 8.9, rank: 2 },
    { id: "3", name: "You", steps: 4250, km: 5.3, rank: 3 },
    { id: "4", name: "Casey", steps: 3100, km: 3.8, rank: 4 },
    { id: "5", name: "Morgan", steps: 2500, km: 3.1, rank: 5 },
  ];

  const challenges: Challenge[] = [
    {
      id: "daily",
      name: "Daily Steps",
      unit: "steps",
      target: 10000,
      deadline: "Today",
    },
    {
      id: "weekly",
      name: "Weekly Distance",
      unit: "km",
      target: 50,
      deadline: "This Week",
    },
    {
      id: "monthly",
      name: "Monthly Challenge",
      unit: "steps",
      target: 300000,
      deadline: "This Month",
    },
  ];

  const currentChallenge =
    challenges.find((c) => c.id === selectedChallenge) || challenges[0];
  const isSteps = currentChallenge.unit === "steps";
  const currentProgress = isSteps ? personalSteps : personalKm;
  const progressPercent = Math.min(
    (currentProgress / currentChallenge.target) * 100,
    100,
  );

  const logActivity = (isSteps: boolean, value: number) => {
    if (isSteps) {
      setPersonalSteps((prev) => prev + value);
    } else {
      setPersonalKm((prev) => prev + value);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold">Sport Challenge</h2>

      {/* Challenge Selector */}
      <div className="space-y-2">
        <h3 className="font-semibold">Active Challenges</h3>
        <div className="grid grid-cols-1 gap-2">
          {challenges.map((challenge) => (
            <button
              key={challenge.id}
              onClick={() => setSelectedChallenge(challenge.id)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                selectedChallenge === challenge.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-border bg-card hover:border-blue-300"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{challenge.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" />
                    {challenge.deadline}
                  </p>
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {challenge.target.toLocaleString()} {challenge.unit}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Challenge Progress */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
        <div className="text-center">
          <h3 className="text-sm text-muted-foreground mb-2">
            {currentChallenge.name}
          </h3>
          <div className="text-4xl font-bold text-green-600 mb-2">
            {currentProgress.toLocaleString()}{" "}
            <span className="text-lg text-muted-foreground">
              {currentChallenge.unit}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Goal: {currentChallenge.target.toLocaleString()}{" "}
            {currentChallenge.unit}
          </p>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="h-3 rounded-full bg-green-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="text-sm font-medium text-muted-foreground mb-4">
            {Math.round(progressPercent)}% Complete
          </p>

          <div className="flex gap-2 justify-center">
            <Button
              size="sm"
              onClick={() => logActivity(isSteps, isSteps ? 500 : 0.5)}
              className="bg-green-600 hover:bg-green-700"
            >
              <TrendingUp className="w-4 h-4 mr-1" />+
              {isSteps ? "500 steps" : "0.5 km"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => logActivity(isSteps, isSteps ? 1000 : 1)}
            >
              +{isSteps ? "1K steps" : "1 km"}
            </Button>
          </div>
        </div>
      </div>

      {/* Team Leaderboard */}
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Team Leaderboard
        </h3>
        <div className="space-y-2 bg-card rounded-lg border border-border overflow-hidden">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className={`p-3 flex justify-between items-center ${member.rank <= 3 ? "bg-yellow-50" : ""}`}
            >
              <div className="flex items-center gap-3 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    member.rank === 1
                      ? "bg-yellow-400 text-white"
                      : member.rank === 2
                        ? "bg-gray-300 text-white"
                        : member.rank === 3
                          ? "bg-orange-400 text-white"
                          : "bg-muted"
                  }`}
                >
                  {member.rank}
                </div>
                <p
                  className={`font-medium ${member.id === "3" ? "text-blue-600 font-bold" : ""}`}
                >
                  {member.name}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-foreground">
                  {member.steps.toLocaleString()} steps
                </p>
                <p className="text-xs text-muted-foreground">{member.km} km</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Personal Stats */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Your Statistics
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-blue-700">Total Steps Today</p>
            <p className="text-2xl font-bold text-blue-900">
              {personalSteps.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-blue-700">Distance Covered</p>
            <p className="text-2xl font-bold text-blue-900">{personalKm} km</p>
          </div>
        </div>
      </div>
    </div>
  );
}
