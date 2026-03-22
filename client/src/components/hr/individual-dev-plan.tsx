"use client";

import { useState } from "react";
import { TrendingUp, Target, BookOpen, DollarSign, Calendar } from "lucide-react";

interface SkillGap {
  id: string;
  skillName: string;
  currentLevel: number;
  targetLevel: number;
  priority: "high" | "medium" | "low";
}

interface Training {
  id: string;
  name: string;
  provider: string;
  duration: string;
  cost: number;
  startDate: string;
  completed: boolean;
  skillIds: string[];
}

const DEFAULT_GAPS: SkillGap[] = [
  {
    id: "1",
    skillName: "Advanced Rust Programming",
    currentLevel: 2,
    targetLevel: 4,
    priority: "high",
  },
  {
    id: "2",
    skillName: "System Architecture Design",
    currentLevel: 2,
    targetLevel: 3,
    priority: "high",
  },
  {
    id: "3",
    skillName: "Cloud Infrastructure (AWS)",
    currentLevel: 1,
    targetLevel: 3,
    priority: "medium",
  },
  {
    id: "4",
    skillName: "Team Leadership",
    currentLevel: 2,
    targetLevel: 4,
    priority: "medium",
  },
];

const DEFAULT_TRAININGS: Training[] = [
  {
    id: "1",
    name: "Rust Web Development Bootcamp",
    provider: "Udacity",
    duration: "8 weeks",
    cost: 899,
    startDate: "2026-04-15",
    completed: false,
    skillIds: ["1"],
  },
  {
    id: "2",
    name: "AWS Solutions Architect",
    provider: "Linux Academy",
    duration: "6 weeks",
    cost: 599,
    startDate: "2026-05-01",
    completed: false,
    skillIds: ["3"],
  },
  {
    id: "3",
    name: "Leadership Fundamentals",
    provider: "Internal Training",
    duration: "12 weeks",
    cost: 0,
    startDate: "2026-04-01",
    completed: false,
    skillIds: ["4"],
  },
];

export function IndividualDevPlan() {
  const [gaps, setGaps] = useState<SkillGap[]>(DEFAULT_GAPS);
  const [trainings, setTrainings] = useState<Training[]>(DEFAULT_TRAININGS);
  const [budgetUsed, setBudgetUsed] = useState(1498);
  const [budgetTotal] = useState(3000);

  const handleToggleTraining = (id: string) => {
    setTrainings(
      trainings.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      )
    );
  };

  const remainingBudget = budgetTotal - budgetUsed;
  const budgetPercent = (budgetUsed / budgetTotal) * 100;

  const completedTrainings = trainings.filter((t) => t.completed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Individual Development Plan
          </h2>
          <p className="text-gray-600">
            Skills development and training roadmap
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700 font-medium">Training Budget</p>
        <div className="flex items-baseline gap-2 mt-1 mb-3">
          <p className="text-2xl font-bold text-blue-900">€{budgetUsed}</p>
          <span className="text-sm text-blue-700">/ €{budgetTotal}</span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
        <p className="text-xs text-blue-700 mt-2">
          €{remainingBudget} remaining
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Skill Gaps & Targets</h3>
        </div>

        <div className="divide-y">
          {gaps.map((gap) => (
            <div key={gap.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-gray-900">{gap.skillName}</p>
                  <span
                    className={`inline-block text-xs px-2 py-1 rounded mt-1 font-medium ${
                      gap.priority === "high"
                        ? "bg-red-100 text-red-800"
                        : gap.priority === "medium"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {gap.priority.charAt(0).toUpperCase() + gap.priority.slice(1)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Current: Level {gap.currentLevel}</span>
                    <span>Target: Level {gap.targetLevel}</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(gap.currentLevel / 5) * 100}%` }}
                      />
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(gap.targetLevel / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Recommended Trainings</h3>
        </div>

        <div className="divide-y">
          {trainings.map((training) => (
            <div
              key={training.id}
              className={`p-4 cursor-pointer transition-all ${
                training.completed ? "bg-green-50" : "hover:bg-gray-50"
              }`}
              onClick={() => handleToggleTraining(training.id)}
            >
              <div className="flex items-start gap-3 mb-2">
                <div className="flex-shrink-0 mt-1">
                  {training.completed ? (
                    <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{training.name}</p>
                  <p className="text-sm text-gray-600">{training.provider}</p>

                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {training.duration}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Start: {training.startDate}
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      €{training.cost}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-medium text-gray-700">Total Trainings</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{trainings.length}</p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-gray-700">Completed</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedTrainings}</p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-purple-600" />
            <p className="text-sm font-medium text-gray-700">Skills Tracked</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{gaps.length}</p>
        </div>
      </div>

      <div className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded-r-lg">
        <p className="text-sm font-medium text-blue-900">Development Timeline</p>
        <p className="text-sm text-blue-800 mt-1">
          Expected completion of all trainings: Q4 2026. Regular check-ins scheduled
          monthly with manager.
        </p>
      </div>
    </div>
  );
}
