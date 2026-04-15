"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  CheckCircle,
  Circle,
  User,
  Users,
  BookOpen,
  Calendar,
} from "lucide-react";

interface MilestoneStep {
  id: string;
  name: string;
  icon: ReactNode;
  tasks: string[];
  completed: boolean;
  dueDate: string;
}

interface Mentee {
  id: string;
  name: string;
  role: string;
  mentorId: string;
}

const DEFAULT_STEPS: MilestoneStep[] = [
  {
    id: "it",
    name: "IT Setup",
    icon: <Circle className="w-5 h-5" />,
    tasks: [
      "Hardware provisioning",
      "Account creation",
      "System access setup",
      "Software licensing",
    ],
    completed: true,
    dueDate: "Day 1",
  },
  {
    id: "hr",
    name: "HR Onboarding",
    icon: <Users className="w-5 h-5" />,
    tasks: [
      "Contracts & documents",
      "Benefits enrollment",
      "Org structure training",
      "Policy review",
    ],
    completed: true,
    dueDate: "Day 1-3",
  },
  {
    id: "training",
    name: "Formation",
    icon: <BookOpen className="w-5 h-5" />,
    tasks: [
      "Product training",
      "System training",
      "Customer overview",
      "Team procedures",
    ],
    completed: false,
    dueDate: "Day 3-7",
  },
];

const DEFAULT_MENTEES: Mentee[] = [
  {
    id: "1",
    name: "Alice Dubois",
    role: "Junior Developer",
    mentorId: "self",
  },
];

export function OnboardingWorkflow() {
  const [steps, setSteps] = useState<MilestoneStep[]>(DEFAULT_STEPS);
  const [mentees, setMentees] = useState<Mentee[]>(DEFAULT_MENTEES);
  const [selectedMentor, setSelectedMentor] = useState<string>("2");

  const handleToggleStep = (stepId: string) => {
    setSteps(
      steps.map((s) =>
        s.id === stepId ? { ...s, completed: !s.completed } : s,
      ),
    );
  };

  const completedSteps = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const progressPercent = (completedSteps / totalSteps) * 100;

  const mentors = [
    { id: "2", name: "Jean Martin" },
    { id: "3", name: "Sophie Bernard" },
    { id: "4", name: "Pierre Dupont" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Onboarding Workflow
          </h2>
          <p className="text-muted-foreground">
            Employee onboarding with milestone tracking
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700 font-medium">Progress</p>
        <p className="text-2xl font-bold text-blue-900">
          {completedSteps}/{totalSteps} Completed
        </p>
        <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              step.completed
                ? "bg-green-50 border-green-300"
                : "bg-card hover:bg-muted"
            }`}
            onClick={() => handleToggleStep(step.id)}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {step.completed ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{step.name}</h3>
                  <span className="text-xs bg-gray-200 text-muted-foreground px-2 py-1 rounded">
                    {step.dueDate}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {step.tasks.map((task, idx) => (
                    <div
                      key={idx}
                      className={`text-xs px-2 py-1 rounded ${
                        step.completed
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      ✓ {task}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="bg-muted border-b p-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">
            Mentoring Assignment
          </h3>
        </div>

        <div className="p-4 space-y-4">
          {mentees.map((mentee) => (
            <div key={mentee.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-foreground">{mentee.name}</p>
                  <p className="text-sm text-muted-foreground">{mentee.role}</p>
                </div>
              </div>

              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Assign Mentor
              </label>
              <select
                value={selectedMentor}
                onChange={(e) => setSelectedMentor(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a mentor...</option>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-medium text-muted-foreground">
              J1 Milestone
            </p>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {steps[0]?.completed ? "✓ Completed" : "In progress"}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-orange-600" />
            <p className="text-sm font-medium text-muted-foreground">
              J7 Milestone
            </p>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {steps[1]?.completed ? "✓ Completed" : "In progress"}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-muted-foreground">
              J30 Milestone
            </p>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            {steps[2]?.completed ? "✓ Completed" : "Scheduled"}
          </p>
        </div>
      </div>
    </div>
  );
}
