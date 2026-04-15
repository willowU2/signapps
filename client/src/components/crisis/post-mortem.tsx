"use client";

import { useState } from "react";
import { Share2, Plus, Trash2, CheckCircle } from "lucide-react";

interface TimelineEvent {
  id: string;
  time: string;
  description: string;
}

interface PostMortemReport {
  id: string;
  title: string;
  date: string;
  timeline: TimelineEvent[];
  rootCauses: string[];
  actionsTaken: string[];
  lessonsLearned: string[];
  status: "draft" | "published";
}

const DEFAULT_REPORT: PostMortemReport = {
  id: "1",
  title: "Production Outage - March 20, 2026",
  date: "2026-03-21",
  status: "published",
  timeline: [
    {
      id: "1",
      time: "14:30",
      description: "Database connection pool exhausted",
    },
    {
      id: "2",
      time: "14:35",
      description: "Alert triggered - manual investigation started",
    },
    {
      id: "3",
      time: "14:50",
      description: "Root cause identified: connection leak",
    },
    {
      id: "4",
      time: "15:15",
      description: "Service restarted, connections normalized",
    },
  ],
  rootCauses: [
    "Connection leak in ORM layer not releasing idle connections",
    "Monitoring alert threshold too high (triggered only after 95% pool saturation)",
    "No automatic connection cleanup job in place",
  ],
  actionsTaken: [
    "Deployed hotfix to properly close idle connections",
    "Lowered alert threshold to 70% pool saturation",
    "Added automated hourly cleanup job",
    "Reviewed 3 other microservices for similar patterns",
  ],
  lessonsLearned: [
    "Monitor connection pool metrics more granularly",
    "Implement circuit breakers for external dependencies",
    "Add load testing for connection leak scenarios",
  ],
};

export function PostMortem() {
  const [report, setReport] = useState<PostMortemReport>(DEFAULT_REPORT);
  const [isEditing, setIsEditing] = useState(false);
  const [newRootCause, setNewRootCause] = useState("");
  const [newAction, setNewAction] = useState("");
  const [newLesson, setNewLesson] = useState("");

  const addRootCause = () => {
    if (newRootCause.trim()) {
      setReport((prev) => ({
        ...prev,
        rootCauses: [...prev.rootCauses, newRootCause],
      }));
      setNewRootCause("");
    }
  };

  const removeRootCause = (index: number) => {
    setReport((prev) => ({
      ...prev,
      rootCauses: prev.rootCauses.filter((_, i) => i !== index),
    }));
  };

  const addAction = () => {
    if (newAction.trim()) {
      setReport((prev) => ({
        ...prev,
        actionsTaken: [...prev.actionsTaken, newAction],
      }));
      setNewAction("");
    }
  };

  const removeAction = (index: number) => {
    setReport((prev) => ({
      ...prev,
      actionsTaken: prev.actionsTaken.filter((_, i) => i !== index),
    }));
  };

  const addLesson = () => {
    if (newLesson.trim()) {
      setReport((prev) => ({
        ...prev,
        lessonsLearned: [...prev.lessonsLearned, newLesson],
      }));
      setNewLesson("");
    }
  };

  const removeLesson = (index: number) => {
    setReport((prev) => ({
      ...prev,
      lessonsLearned: prev.lessonsLearned.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{report.title}</h2>
          <p className="text-muted-foreground">
            {new Date(report.date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 rounded border border-border text-muted-foreground font-medium hover:bg-muted"
          >
            {isEditing ? "View" : "Edit"}
          </button>
          <button className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Timeline Section */}
        <div className="border rounded-lg p-6 bg-background">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Incident Timeline
          </h3>
          <div className="space-y-4">
            {report.timeline.map((event, idx) => (
              <div key={event.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2" />
                  {idx < report.timeline.length - 1 && (
                    <div className="w-0.5 h-12 bg-gray-300" />
                  )}
                </div>
                <div className="pb-4">
                  <p className="font-mono text-sm font-semibold text-foreground">
                    {event.time}
                  </p>
                  <p className="text-muted-foreground">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Root Causes Section */}
        <div className="border rounded-lg p-6 bg-background">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Root Causes
          </h3>
          <div className="space-y-2">
            {report.rootCauses.map((cause, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 bg-red-50 rounded border border-red-200"
              >
                <p className="text-foreground">{cause}</p>
                {isEditing && (
                  <button
                    onClick={() => removeRootCause(idx)}
                    className="text-red-600 hover:text-red-700 ml-2 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {isEditing && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRootCause}
                  onChange={(e) => setNewRootCause(e.target.value)}
                  placeholder="Add root cause..."
                  className="flex-1 rounded border border-border px-3 py-2 text-foreground bg-background"
                  onKeyDown={(e) => e.key === "Enter" && addRootCause()}
                />
                <button
                  onClick={addRootCause}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Actions Taken Section */}
        <div className="border rounded-lg p-6 bg-background">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Actions Taken
          </h3>
          <div className="space-y-2">
            {report.actionsTaken.map((action, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 bg-green-50 rounded border border-green-200"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-foreground">{action}</p>
                </div>
                {isEditing && (
                  <button
                    onClick={() => removeAction(idx)}
                    className="text-red-600 hover:text-red-700 ml-2 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {isEditing && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  placeholder="Add action taken..."
                  className="flex-1 rounded border border-border px-3 py-2 text-foreground bg-background"
                  onKeyDown={(e) => e.key === "Enter" && addAction()}
                />
                <button
                  onClick={addAction}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lessons Learned Section */}
        <div className="border rounded-lg p-6 bg-background">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Lessons Learned
          </h3>
          <div className="space-y-2">
            {report.lessonsLearned.map((lesson, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 bg-yellow-50 rounded border border-yellow-200"
              >
                <p className="text-foreground">{lesson}</p>
                {isEditing && (
                  <button
                    onClick={() => removeLesson(idx)}
                    className="text-red-600 hover:text-red-700 ml-2 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {isEditing && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLesson}
                  onChange={(e) => setNewLesson(e.target.value)}
                  placeholder="Add lesson learned..."
                  className="flex-1 rounded border border-border px-3 py-2 text-foreground bg-background"
                  onKeyDown={(e) => e.key === "Enter" && addLesson()}
                />
                <button
                  onClick={addLesson}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
