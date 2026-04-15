"use client";

import { useState } from "react";
import {
  FileText,
  MessageSquare,
  CheckSquare,
  Archive,
  Clock,
  Users,
} from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  description: string;
  expiresAt: string;
  members: number;
  docs: number;
  chats: number;
  tasks: number;
  isArchived: boolean;
}

const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: "1",
    name: "Q1 Strategy Review",
    description: "Planning and budget allocation for Q1 2026",
    expiresAt: "2026-04-15",
    members: 5,
    docs: 12,
    chats: 28,
    tasks: 15,
    isArchived: false,
  },
  {
    id: "2",
    name: "Product Launch - SaaS",
    description: "Coordination for new SaaS offering",
    expiresAt: "2026-05-20",
    members: 8,
    docs: 23,
    chats: 45,
    tasks: 34,
    isArchived: false,
  },
  {
    id: "3",
    name: "M&A Due Diligence",
    description: "Financial and legal documents review",
    expiresAt: "2026-03-25",
    members: 6,
    docs: 67,
    chats: 12,
    tasks: 8,
    isArchived: false,
  },
];

function calculateDaysRemaining(expiresAt: string): number {
  const today = new Date();
  const expires = new Date(expiresAt);
  const diffTime = expires.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getExpirationColor(daysRemaining: number): string {
  if (daysRemaining <= 3) return "text-red-600 bg-red-50";
  if (daysRemaining <= 7) return "text-orange-600 bg-orange-50";
  return "text-green-600 bg-green-50";
}

export function SharedWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(DEFAULT_WORKSPACES);
  const [activeTab, setActiveTab] = useState<string>("1");

  const handleArchive = (id: string) => {
    setWorkspaces(
      workspaces.map((w) => (w.id === id ? { ...w, isArchived: true } : w)),
    );
  };

  const activeWorkspace =
    workspaces.find((w) => w.id === activeTab) || workspaces[0];
  const daysRemaining = calculateDaysRemaining(activeWorkspace.expiresAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Shared Workspaces
          </h2>
          <p className="text-muted-foreground">
            Collaboration areas with expiration tracking
          </p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="bg-muted border-b overflow-x-auto">
          <div className="flex">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => setActiveTab(workspace.id)}
                className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === workspace.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {workspace.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="font-medium text-foreground">
                {activeWorkspace.description}
              </p>
            </div>

            <div
              className={`rounded-lg p-3 ${getExpirationColor(daysRemaining)}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Expires in</span>
              </div>
              <p className="text-lg font-bold">{daysRemaining} days</p>
              <p className="text-xs opacity-75">{activeWorkspace.expiresAt}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-muted-foreground">
                  Members
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {activeWorkspace.members}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-muted-foreground">
                  Documents
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {activeWorkspace.docs}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-muted-foreground">
                  Chats
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {activeWorkspace.chats}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckSquare className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-medium text-muted-foreground">
                  Tasks
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {activeWorkspace.tasks}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            {!activeWorkspace.isArchived && (
              <button
                onClick={() => handleArchive(activeWorkspace.id)}
                className="flex items-center gap-2 text-muted-foreground hover:text-orange-600 px-4 py-2 rounded-lg border hover:border-orange-300"
              >
                <Archive className="w-4 h-4" />
                Archive Workspace
              </button>
            )}
            {activeWorkspace.isArchived && (
              <span className="text-muted-foreground px-4 py-2 rounded-lg bg-muted border">
                Archived
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Total Workspaces
          </p>
          <p className="text-2xl font-bold text-foreground">
            {workspaces.length}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Total Documents
          </p>
          <p className="text-2xl font-bold text-foreground">
            {workspaces.reduce((sum, w) => sum + w.docs, 0)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground font-medium">
            Active Members
          </p>
          <p className="text-2xl font-bold text-foreground">
            {workspaces.reduce((sum, w) => sum + w.members, 0)}
          </p>
        </div>
      </div>
    </div>
  );
}
