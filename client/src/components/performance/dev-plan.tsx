"use client";

import { useState } from "react";
import {
  CheckCircle,
  Circle,
  Target,
  BookOpen,
  Calendar,
  Check,
  X,
} from "lucide-react";

interface Milestone {
  id: string;
  name: string;
  dueDate: string;
  completed: boolean;
}

interface Training {
  id: string;
  name: string;
  provider: string;
  duration: string;
  completed: boolean;
}

interface Objective {
  id: string;
  title: string;
  description: string;
  status: "not-started" | "in-progress" | "completed";
  trainings: Training[];
  milestones: Milestone[];
  managerApproved: boolean;
}

const DEFAULT_OBJECTIVES: Objective[] = [
  {
    id: "1",
    title: "Master Kubernetes Deployment",
    description:
      "Become proficient in deploying and managing containerized applications",
    status: "in-progress",
    trainings: [
      {
        id: "t1",
        name: "Kubernetes for DevOps Engineers",
        provider: "Linux Academy",
        duration: "4 weeks",
        completed: true,
      },
      {
        id: "t2",
        name: "Advanced Kubernetes Patterns",
        provider: "Pluralsight",
        duration: "3 weeks",
        completed: false,
      },
    ],
    milestones: [
      {
        id: "m1",
        name: "Complete online course",
        dueDate: "2026-04-15",
        completed: true,
      },
      {
        id: "m2",
        name: "Deploy 3 production clusters",
        dueDate: "2026-05-30",
        completed: false,
      },
      {
        id: "m3",
        name: "Certify CKA",
        dueDate: "2026-06-30",
        completed: false,
      },
    ],
    managerApproved: true,
  },
  {
    id: "2",
    title: "Develop Leadership Skills",
    description: "Build capacity to lead technical teams",
    status: "not-started",
    trainings: [
      {
        id: "t3",
        name: "Tech Leadership Essentials",
        provider: "Coursera",
        duration: "6 weeks",
        completed: false,
      },
    ],
    milestones: [
      {
        id: "m4",
        name: "Enroll in training",
        dueDate: "2026-04-01",
        completed: false,
      },
      {
        id: "m5",
        name: "Lead one team initiative",
        dueDate: "2026-07-01",
        completed: false,
      },
    ],
    managerApproved: false,
  },
];

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case "in-progress":
      return <Circle className="w-5 h-5 text-blue-600 fill-blue-600" />;
    default:
      return <Circle className="w-5 h-5 text-gray-400" />;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-50 border-green-200";
    case "in-progress":
      return "bg-blue-50 border-blue-200";
    default:
      return "bg-muted border-border";
  }
}

export function DevPlan() {
  const [objectives, setObjectives] = useState<Objective[]>(DEFAULT_OBJECTIVES);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    setObjectives(
      objectives.map((obj) =>
        obj.id === id ? { ...obj, managerApproved: true } : obj,
      ),
    );
  };

  const handleReject = (id: string) => {
    setObjectives(
      objectives.map((obj) =>
        obj.id === id ? { ...obj, managerApproved: false } : obj,
      ),
    );
  };

  const handleToggleTrainingCompletion = (
    objId: string,
    trainingId: string,
  ) => {
    setObjectives(
      objectives.map((obj) =>
        obj.id === objId
          ? {
              ...obj,
              trainings: obj.trainings.map((t) =>
                t.id === trainingId ? { ...t, completed: !t.completed } : t,
              ),
            }
          : obj,
      ),
    );
  };

  const handleToggleMilestoneCompletion = (
    objId: string,
    milestoneId: string,
  ) => {
    setObjectives(
      objectives.map((obj) =>
        obj.id === objId
          ? {
              ...obj,
              milestones: obj.milestones.map((m) =>
                m.id === milestoneId ? { ...m, completed: !m.completed } : m,
              ),
            }
          : obj,
      ),
    );
  };

  const completionPercentages = objectives.map((obj) => {
    const totalItems = obj.trainings.length + obj.milestones.length;
    const completedItems =
      obj.trainings.filter((t) => t.completed).length +
      obj.milestones.filter((m) => m.completed).length;
    return totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Development Plan</h2>
        <p className="text-muted-foreground">
          Track objectives, trainings, and milestones
        </p>
      </div>

      <div className="space-y-4">
        {objectives.map((objective, idx) => {
          const isExpanded = expandedId === objective.id;
          const progress = completionPercentages[idx];

          return (
            <div
              key={objective.id}
              className={`border rounded-lg overflow-hidden ${getStatusColor(objective.status)}`}
            >
              <div
                className="p-6 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setExpandedId(isExpanded ? null : objective.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getStatusIcon(objective.status)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">
                        {objective.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {objective.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!objective.managerApproved && (
                      <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-800 rounded">
                        Awaiting Approval
                      </span>
                    )}
                    {objective.managerApproved && (
                      <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-800 rounded">
                        Approved
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-foreground">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t bg-card p-6 space-y-6">
                  {/* Trainings Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-foreground">
                        Linked Trainings
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {objective.trainings.map((training) => (
                        <div
                          key={training.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={training.completed}
                              onChange={() =>
                                handleToggleTrainingCompletion(
                                  objective.id,
                                  training.id,
                                )
                              }
                              className="rounded"
                            />
                            <div>
                              <p className="font-medium text-foreground">
                                {training.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {training.provider} • {training.duration}
                              </p>
                            </div>
                          </div>
                          {training.completed && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Milestones Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-5 h-5 text-purple-600" />
                      <h4 className="font-semibold text-foreground">
                        Milestones
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {objective.milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={milestone.completed}
                              onChange={() =>
                                handleToggleMilestoneCompletion(
                                  objective.id,
                                  milestone.id,
                                )
                              }
                              className="rounded"
                            />
                            <div>
                              <p className="font-medium text-foreground">
                                {milestone.name}
                              </p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(
                                  milestone.dueDate,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {milestone.completed && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Manager Approval */}
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Manager Approval
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(objective.id)}
                        disabled={objective.managerApproved}
                        className="flex-1 px-3 py-2 rounded bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(objective.id)}
                        disabled={!objective.managerApproved}
                        className="flex-1 px-3 py-2 rounded bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
