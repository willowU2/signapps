"use client";

import { useState } from "react";
import { Plus, Trash2, Clock } from "lucide-react";

interface ChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
}

interface TeamRole {
  id: string;
  role: string;
  assignee: string;
  status: "ready" | "notified" | "engaged";
}

interface TimelineEvent {
  id: string;
  time: string;
  event: string;
  severity: "critical" | "warning" | "info";
}

interface DecisionLog {
  id: string;
  time: string;
  decision: string;
  owner: string;
  impact: string;
}

const SAMPLE_CHECKLIST: ChecklistItem[] = [
  { id: "c1", task: "Declare incident", completed: true, priority: "high" },
  { id: "c2", task: "Activate war room", completed: true, priority: "high" },
  { id: "c3", task: "Notify stakeholders", completed: true, priority: "high" },
  {
    id: "c4",
    task: "Begin failover sequence",
    completed: true,
    priority: "high",
  },
  {
    id: "c5",
    task: "Monitor recovery progress",
    completed: false,
    priority: "high",
  },
];

const SAMPLE_ROLES: TeamRole[] = [
  {
    id: "r1",
    role: "Incident Commander",
    assignee: "John Smith",
    status: "engaged",
  },
  {
    id: "r2",
    role: "Technical Lead",
    assignee: "Sarah Johnson",
    status: "engaged",
  },
  {
    id: "r3",
    role: "Comms Manager",
    assignee: "Mike Chen",
    status: "notified",
  },
];

const SAMPLE_TIMELINE: TimelineEvent[] = [
  {
    id: "t1",
    time: "09:15",
    event: "Anomaly detected in primary DC",
    severity: "critical",
  },
  {
    id: "t2",
    time: "09:18",
    event: "War room activated",
    severity: "critical",
  },
  { id: "t3", time: "09:22", event: "Failover initiated", severity: "warning" },
  { id: "t4", time: "09:45", event: "Secondary DC online", severity: "info" },
];

const SAMPLE_DECISIONS: DecisionLog[] = [
  {
    id: "d1",
    time: "09:20",
    decision: "Trigger full failover to DR site",
    owner: "CTO",
    impact: "Services restored in 30min",
  },
  {
    id: "d2",
    time: "09:35",
    decision: "Activate alternative routing",
    owner: "Network Lead",
    impact: "99.9% uptime maintained",
  },
];

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-yellow-100 text-yellow-700";
    case "low":
      return "bg-green-100 text-green-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "engaged":
      return "text-green-600";
    case "notified":
      return "text-blue-600";
    case "ready":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

export function WarRoom() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(SAMPLE_CHECKLIST);
  const completedCount = checklist.filter((c) => c.completed).length;

  const toggleChecklistItem = (id: string) => {
    setChecklist(
      checklist.map((c) =>
        c.id === id ? { ...c, completed: !c.completed } : c,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Crisis War Room</h2>
        <p className="text-muted-foreground">
          Coordinate incident response in real-time
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Checklist Progress</p>
          <p className="text-2xl font-bold text-blue-600">
            {completedCount}/{checklist.length}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Team Engaged</p>
          <p className="text-2xl font-bold text-green-600">
            {SAMPLE_ROLES.filter((r) => r.status === "engaged").length}/
            {SAMPLE_ROLES.length}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Critical Events</p>
          <p className="text-2xl font-bold text-amber-600">
            {SAMPLE_TIMELINE.filter((t) => t.severity === "critical").length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checklist */}
        <div className="border rounded-lg p-4 bg-background">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Response Checklist
            </h3>
            <button className="p-1 hover:bg-gray-200 rounded text-muted-foreground">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {checklist.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => toggleChecklistItem(item.id)}
                  className="rounded"
                />
                <span
                  className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
                >
                  {item.task}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${getPriorityColor(item.priority)}`}
                >
                  {item.priority}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Team Roles */}
        <div className="border rounded-lg p-4 bg-background">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Team Roles
          </h3>
          <div className="space-y-2">
            {SAMPLE_ROLES.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-2 rounded border hover:bg-muted"
              >
                <div>
                  <p className="font-medium text-foreground">{role.role}</p>
                  <p className="text-sm text-muted-foreground">
                    {role.assignee}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold capitalize ${getStatusColor(role.status)}`}
                >
                  {role.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="border rounded-lg p-4 bg-background">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Timeline
        </h3>
        <div className="space-y-2">
          {SAMPLE_TIMELINE.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-2 rounded hover:bg-muted"
            >
              <span
                className={`text-sm font-mono font-bold ${event.severity === "critical" ? "text-red-600" : event.severity === "warning" ? "text-amber-600" : "text-blue-600"}`}
              >
                {event.time}
              </span>
              <p className="text-sm text-foreground flex-1">{event.event}</p>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded ${
                  event.severity === "critical"
                    ? "bg-red-100 text-red-700"
                    : event.severity === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                {event.severity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Decision Log */}
      <div className="border rounded-lg p-4 bg-background">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Decision Log
        </h3>
        <div className="space-y-3">
          {SAMPLE_DECISIONS.map((decision) => (
            <div
              key={decision.id}
              className="border rounded p-3 hover:bg-muted"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-mono text-muted-foreground">
                  {decision.time}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {decision.owner}
                </span>
              </div>
              <p className="font-medium text-foreground mb-1">
                {decision.decision}
              </p>
              <p className="text-sm text-green-700 bg-green-50 px-2 py-1 rounded">
                Impact: {decision.impact}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
