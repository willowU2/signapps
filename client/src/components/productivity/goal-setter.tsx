"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Target, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type KeyResult = {
  id: string;
  title: string;
  progress: number;
};

type Goal = {
  id: string;
  title: string;
  quarter: string;
  keyResults: KeyResult[];
};

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

export function GoalSetter() {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: "1",
      title: "Launch Mobile App",
      quarter: "Q1",
      keyResults: [
        { id: "kr1", title: "Design & Prototype", progress: 100 },
        { id: "kr2", title: "Core Development", progress: 75 },
        { id: "kr3", title: "Testing & QA", progress: 40 },
      ],
    },
    {
      id: "2",
      title: "Expand Team",
      quarter: "Q2",
      keyResults: [
        { id: "kr4", title: "Hire 3 Engineers", progress: 50 },
        { id: "kr5", title: "Setup Onboarding", progress: 80 },
      ],
    },
  ]);

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalQuarter, setNewGoalQuarter] = useState("Q1");

  const addGoal = () => {
    if (newGoalTitle.trim()) {
      setGoals([
        ...goals,
        {
          id: Date.now().toString(),
          title: newGoalTitle,
          quarter: newGoalQuarter,
          keyResults: [],
        },
      ]);
      setNewGoalTitle("");
    }
  };

  const addKeyResult = (goalId: string, krTitle: string) => {
    setGoals(
      goals.map((goal) => {
        if (goal.id === goalId && krTitle.trim()) {
          return {
            ...goal,
            keyResults: [
              ...goal.keyResults,
              { id: Date.now().toString(), title: krTitle, progress: 0 },
            ],
          };
        }
        return goal;
      })
    );
  };

  const updateProgress = (
    goalId: string,
    krId: string,
    progress: number
  ) => {
    setGoals(
      goals.map((goal) => {
        if (goal.id === goalId) {
          return {
            ...goal,
            keyResults: goal.keyResults.map((kr) =>
              kr.id === krId ? { ...kr, progress: Math.min(100, Math.max(0, progress)) } : kr
            ),
          };
        }
        return goal;
      })
    );
  };

  const deleteGoal = (goalId: string) => {
    setGoals(goals.filter((g) => g.id !== goalId));
  };

  const deleteKeyResult = (goalId: string, krId: string) => {
    setGoals(
      goals.map((goal) => {
        if (goal.id === goalId) {
          return {
            ...goal,
            keyResults: goal.keyResults.filter((kr) => kr.id !== krId),
          };
        }
        return goal;
      })
    );
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "bg-emerald-500";
    if (progress >= 50) return "bg-blue-500";
    if (progress >= 25) return "bg-yellow-500";
    return "bg-gray-300";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Quarterly Goals
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Add Goal Form */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add a new goal..."
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
                className="flex-1 px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newGoalQuarter}
                onChange={(e) => setNewGoalQuarter(e.target.value)}
                className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
              <Button onClick={addGoal} size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Goals List */}
          <div className="space-y-4">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="p-4 border border-border rounded-lg hover:shadow-md transition-shadow"
              >
                {/* Goal Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{goal.title}</h3>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1 inline-block">
                      {goal.quarter}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="p-1 hover:bg-red-50 rounded text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Key Results */}
                <div className="space-y-3">
                  {goal.keyResults.length > 0 ? (
                    goal.keyResults.map((kr) => (
                      <div key={kr.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            {kr.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                              {kr.progress}%
                            </span>
                            <button
                              onClick={() =>
                                deleteKeyResult(goal.id, kr.id)
                              }
                              className="p-0.5 hover:bg-red-50 rounded text-red-500 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full transition-all",
                              getProgressColor(kr.progress)
                            )}
                            style={{ width: `${kr.progress}%` }}
                          />
                        </div>

                        {/* Progress Controls */}
                        <div className="flex gap-1 text-xs">
                          {[25, 50, 75, 100].map((val) => (
                            <button
                              key={val}
                              onClick={() =>
                                updateProgress(goal.id, kr.id, val)
                              }
                              className={cn(
                                "px-2 py-0.5 rounded border text-xs font-medium transition",
                                kr.progress === val
                                  ? "border-blue-500 bg-blue-50 text-blue-700"
                                  : "border-border text-muted-foreground hover:border-border"
                              )}
                            >
                              {val}%
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No key results yet
                    </p>
                  )}
                </div>

                {/* Add Key Result */}
                <KeyResultInput onAdd={(title) => addKeyResult(goal.id, title)} />
              </div>
            ))}
          </div>

          {goals.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No goals yet. Create one to get started!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KeyResultInput({
  onAdd,
}: {
  onAdd: (title: string) => void;
}) {
  const [value, setValue] = useState("");

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value);
      setValue("");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add key result..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 px-2 py-1.5 border border-border rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition"
        >
          Add KR
        </button>
      </div>
    </div>
  );
}
