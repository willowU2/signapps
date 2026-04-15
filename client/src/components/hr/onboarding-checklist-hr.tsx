"use client";

import { useState } from "react";
import {
  CheckCircle,
  Circle,
  Users,
  Lock,
  GraduationCap,
  User,
} from "lucide-react";

interface OnboardingTask {
  id: string;
  title: string;
  category: "it" | "access" | "training" | "meeting";
  completed: boolean;
  description: string;
}

const DEFAULT_TASKS: OnboardingTask[] = [
  {
    id: "1",
    title: "Laptop Setup",
    category: "it",
    completed: true,
    description: "Configure workstation with necessary software",
  },
  {
    id: "2",
    title: "Phone & SIM",
    category: "it",
    completed: true,
    description: "Issue phone device and SIM card",
  },
  {
    id: "3",
    title: "Email Account",
    category: "it",
    completed: false,
    description: "Create email address and configure clients",
  },
  {
    id: "4",
    title: "VPN Access",
    category: "access",
    completed: false,
    description: "Setup VPN credentials and security keys",
  },
  {
    id: "5",
    title: "System Access",
    category: "access",
    completed: true,
    description: "Grant access to enterprise systems",
  },
  {
    id: "6",
    title: "Company Policies",
    category: "training",
    completed: true,
    description: "Complete company policy training",
  },
  {
    id: "7",
    title: "Safety Training",
    category: "training",
    completed: false,
    description: "Complete workplace safety training",
  },
  {
    id: "8",
    title: "Manager Meeting",
    category: "meeting",
    completed: false,
    description: "Initial meeting with direct manager",
  },
];

function getCategoryIcon(category: string) {
  switch (category) {
    case "it":
      return <Lock className="w-4 h-4 text-blue-600" />;
    case "access":
      return <Lock className="w-4 h-4 text-purple-600" />;
    case "training":
      return <GraduationCap className="w-4 h-4 text-orange-600" />;
    case "meeting":
      return <User className="w-4 h-4 text-green-600" />;
    default:
      return null;
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "it":
      return "IT Setup";
    case "access":
      return "Access";
    case "training":
      return "Training";
    case "meeting":
      return "Manager Meeting";
    default:
      return "";
  }
}

export function OnboardingChecklistHr() {
  const [tasks, setTasks] = useState<OnboardingTask[]>(DEFAULT_TASKS);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const handleToggleTask = (id: string) => {
    setTasks(
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const tasksByCategory = {
    it: tasks.filter((t) => t.category === "it"),
    access: tasks.filter((t) => t.category === "access"),
    training: tasks.filter((t) => t.category === "training"),
    meeting: tasks.filter((t) => t.category === "meeting"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Onboarding Checklist
        </h2>
        <p className="text-muted-foreground">
          New employee onboarding progress tracking
        </p>
      </div>

      <div className="rounded-lg border p-6 bg-card">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-foreground">Overall Progress</p>
          <p className="text-sm font-bold text-muted-foreground">
            {completedCount} of {totalCount} completed
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-green-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {progressPercent}% complete
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(tasksByCategory).map(([category, categoryTasks]) => (
          <div key={category} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              {getCategoryIcon(category)}
              <h3 className="font-semibold text-foreground">
                {getCategoryLabel(category)}
              </h3>
              <span className="text-xs text-muted-foreground">
                ({categoryTasks.filter((t) => t.completed).length}/
                {categoryTasks.length})
              </span>
            </div>

            <div className="space-y-2">
              {categoryTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                  onClick={() => handleToggleTask(task.id)}
                >
                  <div className="mt-0.5">
                    {task.completed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        task.completed
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
