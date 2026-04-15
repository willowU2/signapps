"use client";

import { useState } from "react";
import { CheckCircle, Circle, Lock, Package, FileText } from "lucide-react";

interface OffboardingTask {
  id: string;
  category: "equipment" | "access" | "documentation";
  title: string;
  description: string;
  completed: boolean;
  assignedTo: string;
  dueDate: string;
}

const DEFAULT_TASKS: OffboardingTask[] = [
  {
    id: "1",
    category: "equipment",
    title: "Laptop Return",
    description: "Collect company laptop and accessories",
    completed: false,
    assignedTo: "IT Manager",
    dueDate: "Today",
  },
  {
    id: "2",
    category: "equipment",
    title: "Mobile Device Return",
    description: "Collect company phone and SIM card",
    completed: false,
    assignedTo: "IT Manager",
    dueDate: "Today",
  },
  {
    id: "3",
    category: "equipment",
    title: "Access Cards & Keys",
    description: "Collect building access cards and office keys",
    completed: false,
    assignedTo: "Facilities",
    dueDate: "Today",
  },
  {
    id: "4",
    category: "access",
    title: "Email Suspension",
    description: "Suspend email and communication access",
    completed: false,
    assignedTo: "IT Security",
    dueDate: "Today",
  },
  {
    id: "5",
    category: "access",
    title: "System Access Revocation",
    description: "Remove access to all systems and databases",
    completed: false,
    assignedTo: "IT Security",
    dueDate: "Today",
  },
  {
    id: "6",
    category: "documentation",
    title: "Final Paycheck",
    description: "Process final paycheck and accruals",
    completed: false,
    assignedTo: "Payroll",
    dueDate: "Within 3 days",
  },
];

export function OffboardingChecklist() {
  const [tasks, setTasks] = useState<OffboardingTask[]>(DEFAULT_TASKS);
  const [exitNotes, setExitNotes] = useState("");

  const handleToggleTask = (id: string) => {
    setTasks(
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;
  const progressPercent = (completedTasks / totalTasks) * 100;

  const equipmentTasks = tasks.filter((t) => t.category === "equipment");
  const accessTasks = tasks.filter((t) => t.category === "access");
  const docTasks = tasks.filter((t) => t.category === "documentation");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Offboarding Checklist
          </h2>
          <p className="text-muted-foreground">
            Employee exit and access revocation workflow
          </p>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <p className="text-sm text-orange-700 font-medium">
          Completion Progress
        </p>
        <p className="text-2xl font-bold text-orange-900">
          {completedTasks}/{totalTasks} Tasks
        </p>
        <div className="mt-2 w-full bg-orange-200 rounded-full h-2">
          <div
            className="bg-orange-600 h-2 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border p-4 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-medium text-blue-700">Equipment</p>
          </div>
          <p className="text-lg font-bold text-blue-900">
            {equipmentTasks.filter((t) => t.completed).length}/
            {equipmentTasks.length}
          </p>
        </div>

        <div className="rounded-lg border p-4 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-red-600" />
            <p className="text-sm font-medium text-red-700">Access Revoked</p>
          </div>
          <p className="text-lg font-bold text-red-900">
            {accessTasks.filter((t) => t.completed).length}/{accessTasks.length}
          </p>
        </div>

        <div className="rounded-lg border p-4 bg-green-50">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-green-600" />
            <p className="text-sm font-medium text-green-700">Documentation</p>
          </div>
          <p className="text-lg font-bold text-green-900">
            {docTasks.filter((t) => t.completed).length}/{docTasks.length}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {["equipment", "access", "documentation"].map((category) => (
          <div
            key={category}
            className="border rounded-lg overflow-hidden bg-card"
          >
            <div className="bg-muted border-b p-4">
              <h3 className="font-semibold text-foreground capitalize">
                {category === "equipment"
                  ? "Equipment Return"
                  : category === "access"
                    ? "Access Revocation"
                    : "Documentation & Final Items"}
              </h3>
            </div>

            <div className="divide-y">
              {tasks
                .filter((t) => t.category === category)
                .map((task) => (
                  <div
                    key={task.id}
                    className={`p-4 cursor-pointer transition-all ${
                      task.completed ? "bg-green-50" : "hover:bg-muted"
                    }`}
                    onClick={() => handleToggleTask(task.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {task.completed ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {task.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {task.description}
                        </p>
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Assigned: {task.assignedTo}</span>
                          <span>Due: {task.dueDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          Exit Interview Notes
        </label>
        <textarea
          value={exitNotes}
          onChange={(e) => setExitNotes(e.target.value)}
          placeholder="Document exit interview feedback and notes..."
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
          rows={4}
        />
      </div>

      <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4 rounded-r-lg">
        <p className="text-sm font-medium text-yellow-900">Important</p>
        <p className="text-sm text-yellow-800 mt-1">
          Ensure all tasks are completed before final departure. Non-completion
          may result in security risks or regulatory compliance issues.
        </p>
      </div>
    </div>
  );
}
