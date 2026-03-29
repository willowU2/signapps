"use client";

import { useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ActionItem {
  id: string;
  title: string;
  deadline: Date;
  owner: string;
  status: "Pending" | "InProgress" | "Completed";
  description?: string;
}

interface PDCAPhase {
  phase: "Plan" | "Do" | "Check" | "Act";
  items: ActionItem[];
}

interface CorrectiveActionsProps {
  ncrId?: string;
  onActionAdd?: (phase: string, action: Omit<ActionItem, "id">) => void;
  onActionUpdate?: (id: string, action: Partial<ActionItem>) => void;
  onActionDelete?: (id: string) => void;
  initialActions?: ActionItem[];
}

export function CorrectiveActions({
  ncrId,
  onActionAdd,
  onActionUpdate,
  onActionDelete,
  initialActions = [],
}: CorrectiveActionsProps) {
  const [actions, setActions] = useState<ActionItem[]>(initialActions);
  const [expandedPhase, setExpandedPhase] = useState<"Plan" | "Do" | "Check" | "Act" | null>(null);
  const [newActionPhase, setNewActionPhase] = useState<"Plan" | "Do" | "Check" | "Act" | null>(null);
  const [newActionForm, setNewActionForm] = useState({
    title: "",
    owner: "",
    deadline: new Date(Date.now() + 7 * 24 * 3600000).toISOString().split("T")[0],
    description: "",
  });

  const phases: ("Plan" | "Do" | "Check" | "Act")[] = ["Plan", "Do", "Check", "Act"];

  const phaseDescriptions = {
    Plan: "Define the corrective action plan and strategy",
    Do: "Execute the planned corrective actions",
    Check: "Verify and monitor the effectiveness",
    Act: "Finalize and standardize improvements",
  };

  const phaseColors = {
    Plan: "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700",
    Do: "bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-700",
    Check: "bg-purple-50 dark:bg-purple-950 border-purple-300 dark:border-purple-700",
    Act: "bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700",
  };

  const getActionsForPhase = (phase: string): ActionItem[] => {
    return actions.filter((a) => a.status === "Pending" || phase === "Do");
  };

  const handleAddAction = (phase: "Plan" | "Do" | "Check" | "Act") => {
    if (!newActionForm.title || !newActionForm.owner) {
      return;
    }

    const action: ActionItem = {
      id: `action-${Date.now()}`,
      title: newActionForm.title,
      owner: newActionForm.owner,
      deadline: new Date(newActionForm.deadline),
      status: "Pending",
      description: newActionForm.description,
    };

    setActions((prev) => [action, ...prev]);
    onActionAdd?.(phase, { title: action.title, deadline: action.deadline, owner: action.owner, status: action.status, description: action.description });

    setNewActionForm({
      title: "",
      owner: "",
      deadline: new Date(Date.now() + 7 * 24 * 3600000).toISOString().split("T")[0],
      description: "",
    });
    setNewActionPhase(null);
  };

  const handleUpdateAction = (id: string, status: "Pending" | "InProgress" | "Completed") => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    onActionUpdate?.(id, { status });
  };

  const handleDeleteAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
    onActionDelete?.(id);
  };

  const statusIcons = {
    Pending: <Circle className="size-4 text-gray-400" />,
    InProgress: <Circle className="size-4 text-orange-500 fill-orange-500" />,
    Completed: <CheckCircle2 className="size-4 text-green-500" />,
  };

  const overallCompletion = Math.round(
    (actions.filter((a) => a.status === "Completed").length / actions.length) * 100 || 0
  );

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">PDCA Corrective Actions</h1>
          {ncrId && (
            <p className="text-sm text-muted-foreground dark:text-gray-400">NCR ID: {ncrId}</p>
          )}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm font-medium">Overall Progress</p>
              <div className="w-48 bg-gray-300 dark:bg-gray-700 rounded-full h-2 mt-1">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${overallCompletion}%` }}
                />
              </div>
            </div>
            <p className="text-2xl font-bold">{overallCompletion}%</p>
          </div>
        </div>
      </Card>

      {/* PDCA Phases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {phases.map((phase) => (
          <Card key={phase} className={`p-6 border-2 ${phaseColors[phase]}`}>
            {/* Phase Header */}
            <div className="mb-4">
              <h2 className="text-xl font-bold">{phase}</h2>
              <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
                {phaseDescriptions[phase]}
              </p>
            </div>

            {/* New Action Form */}
            {newActionPhase === phase && (
              <div className="mb-4 p-4 border-2 border-dashed rounded bg-card/50 dark:bg-gray-900/50 space-y-3">
                <input
                  type="text"
                  value={newActionForm.title}
                  onChange={(e) => setNewActionForm({ ...newActionForm, title: e.target.value })}
                  placeholder="Action title..."
                  className="w-full px-3 py-2 border rounded text-sm bg-card dark:bg-gray-900 dark:border-gray-700"
                />

                <input
                  type="text"
                  value={newActionForm.owner}
                  onChange={(e) => setNewActionForm({ ...newActionForm, owner: e.target.value })}
                  placeholder="Responsible person..."
                  className="w-full px-3 py-2 border rounded text-sm bg-card dark:bg-gray-900 dark:border-gray-700"
                />

                <input
                  type="date"
                  value={newActionForm.deadline}
                  onChange={(e) => setNewActionForm({ ...newActionForm, deadline: e.target.value })}
                  className="w-full px-3 py-2 border rounded text-sm bg-card dark:bg-gray-900 dark:border-gray-700"
                />

                <textarea
                  value={newActionForm.description}
                  onChange={(e) => setNewActionForm({ ...newActionForm, description: e.target.value })}
                  placeholder="Description (optional)..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded text-sm bg-card dark:bg-gray-900 dark:border-gray-700"
                />

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAddAction(phase)}
                    size="sm"
                    disabled={!newActionForm.title || !newActionForm.owner}
                  >
                    Add Action
                  </Button>
                  <Button
                    onClick={() => setNewActionPhase(null)}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Phase Actions */}
            <div className="space-y-2 mb-4">
              {actions
                .filter((a) => {
                  // Show all pending/in-progress in Plan
                  if (phase === "Plan") return a.status !== "Completed";
                  // Show in-progress in Do
                  if (phase === "Do") return a.status === "InProgress";
                  // Show completed in Check and Act
                  return a.status === "Completed";
                })
                .map((action) => (
                  <div key={action.id} className="flex items-start gap-3 p-3 border rounded bg-card dark:bg-gray-900/50">
                    <button
                      onClick={() => {
                        const nextStatus =
                          action.status === "Pending"
                            ? "InProgress"
                            : action.status === "InProgress"
                              ? "Completed"
                              : "Pending";
                        handleUpdateAction(action.id, nextStatus);
                      }}
                      className="mt-1 flex-shrink-0"
                    >
                      {statusIcons[action.status]}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{action.title}</p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                        Owner: {action.owner}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-400">
                        Due: {action.deadline.toLocaleDateString()}
                      </p>
                      {action.description && (
                        <p className="text-xs text-muted-foreground dark:text-gray-400 mt-2">
                          {action.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteAction(action.id)}
                      className="flex-shrink-0 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    >
                      <Trash2 className="size-4 text-red-500" />
                    </button>
                  </div>
                ))}
            </div>

            {/* Add Action Button */}
            {newActionPhase !== phase && (
              <Button
                onClick={() => setNewActionPhase(phase)}
                variant="outline"
                size="sm"
                className="w-full gap-2"
              >
                <Plus className="size-4" />
                Add Action
              </Button>
            )}
          </Card>
        ))}
      </div>

      {/* Action Timeline */}
      {actions.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Upcoming Deadlines</h2>
          <div className="space-y-2">
            {actions
              .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
              .slice(0, 5)
              .map((action) => (
                <div key={action.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{action.title}</p>
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      {action.deadline.toLocaleDateString()} • {action.owner}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      action.status === "Completed"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30"
                        : action.status === "InProgress"
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30"
                          : "bg-muted text-gray-800 dark:bg-gray-800"
                    }`}
                  >
                    {action.status}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
