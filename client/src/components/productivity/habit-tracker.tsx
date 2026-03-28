"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Flame, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type HabitEntry = {
  id: string;
  name: string;
  completed: boolean[];
  streak: number;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const INTENSITY_COLORS = [
  "bg-gray-100",
  "bg-emerald-100",
  "bg-emerald-300",
  "bg-emerald-500",
  "bg-emerald-700",
];

export function HabitTracker() {
  const [habits, setHabits] = useState<HabitEntry[]>([
    {
      id: "1",
      name: "Morning Run",
      completed: [true, true, false, true, true, true, false],
      streak: 5,
    },
    {
      id: "2",
      name: "Read 30 min",
      completed: [true, true, true, true, false, true, true],
      streak: 6,
    },
  ]);
  const [newHabitName, setNewHabitName] = useState("");

  const addHabit = () => {
    if (newHabitName.trim()) {
      setHabits([
        ...habits,
        {
          id: Date.now().toString(),
          name: newHabitName,
          completed: Array(7).fill(false),
          streak: 0,
        },
      ]);
      setNewHabitName("");
    }
  };

  const toggleDay = (habitId: string, dayIndex: number) => {
    setHabits(
      habits.map((habit) => {
        if (habit.id === habitId) {
          const newCompleted = [...habit.completed];
          newCompleted[dayIndex] = !newCompleted[dayIndex];
          const newStreak = calculateStreak(newCompleted);
          return { ...habit, completed: newCompleted, streak: newStreak };
        }
        return habit;
      })
    );
  };

  const calculateStreak = (completed: boolean[]): number => {
    let streak = 0;
    for (let i = completed.length - 1; i >= 0; i--) {
      if (completed[i]) streak++;
      else break;
    }
    return streak;
  };

  const deleteHabit = (habitId: string) => {
    setHabits(habits.filter((h) => h.id !== habitId));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Habit Tracker
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Add Habit Form */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a new habit..."
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button onClick={addHabit} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Habits List */}
          <div className="space-y-4">
            {habits.map((habit) => (
              <div key={habit.id} className="pb-4 border-b border-gray-100 last:border-b-0">
                {/* Habit Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900">{habit.name}</h3>
                    {habit.streak > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                        <Flame className="w-3 h-3" />
                        {habit.streak} day
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    className="p-1 hover:bg-red-50 rounded text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Day Checkboxes */}
                <div className="flex gap-1.5">
                  {DAYS.map((day, index) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(habit.id, index)}
                      className={cn(
                        "w-10 h-10 rounded-md font-semibold text-xs transition-all",
                        habit.completed[index]
                          ? "bg-emerald-500 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {habits.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No habits yet. Create one to get started!</p>
            </div>
          )}

          {/* Contribution Heatmap */}
          {habits.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Completion Heatmap</h4>
              <div className="space-y-2">
                {habits.map((habit) => (
                  <div key={`${habit.id}-heatmap`} className="flex gap-1">
                    <span className="text-xs font-medium text-gray-600 w-24 truncate">
                      {habit.name}
                    </span>
                    <div className="flex gap-1">
                      {habit.completed.map((completed, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-5 h-5 rounded-sm transition-colors",
                            completed
                              ? "bg-emerald-500 shadow-sm"
                              : "bg-gray-100"
                          )}
                          title={`${DAYS[idx]}: ${completed ? "Fait" : "Manque"}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
