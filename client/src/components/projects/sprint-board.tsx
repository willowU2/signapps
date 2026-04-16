"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  LayoutList,
  SquareKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type StoryStatus = "backlog" | "todo" | "in-progress" | "done";

interface Story {
  id: string;
  title: string;
  points: number;
  status: StoryStatus;
  sprintId: string | null;
  assignee: string;
  priority: "low" | "medium" | "high";
}

interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  goal: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLUMNS: { id: StoryStatus; label: string }[] = [
  { id: "todo", label: "À faire" },
  { id: "in-progress", label: "En cours" },
  { id: "done", label: "Terminé" },
];

const PRIORITY_COLORS = {
  low: "bg-slate-200",
  medium: "bg-blue-200",
  high: "bg-orange-300",
};

const INITIAL_SPRINTS: Sprint[] = [
  {
    id: "s1",
    name: "Sprint 1",
    startDate: "2026-03-17",
    endDate: "2026-03-28",
    goal: "Authentification et API de base",
  },
  {
    id: "s2",
    name: "Sprint 2",
    startDate: "2026-03-31",
    endDate: "2026-04-11",
    goal: "Dashboard et notifications",
  },
];

const INITIAL_STORIES: Story[] = [
  {
    id: "1",
    title: "Login/logout OAuth",
    points: 5,
    status: "done",
    sprintId: "s1",
    assignee: "AL",
    priority: "high",
  },
  {
    id: "2",
    title: "JWT refresh token",
    points: 3,
    status: "done",
    sprintId: "s1",
    assignee: "JD",
    priority: "high",
  },
  {
    id: "3",
    title: "API contacts CRUD",
    points: 8,
    status: "in-progress",
    sprintId: "s1",
    assignee: "MR",
    priority: "medium",
  },
  {
    id: "4",
    title: "Filtres de recherche",
    points: 3,
    status: "todo",
    sprintId: "s1",
    assignee: "AL",
    priority: "low",
  },
  {
    id: "5",
    title: "Dashboard métriques",
    points: 5,
    status: "todo",
    sprintId: "s2",
    assignee: "JD",
    priority: "medium",
  },
  {
    id: "6",
    title: "Notifications email",
    points: 8,
    status: "todo",
    sprintId: "s2",
    assignee: "",
    priority: "medium",
  },
  {
    id: "7",
    title: "Export PDF rapport",
    points: 3,
    status: "todo",
    sprintId: null,
    assignee: "",
    priority: "low",
  },
  {
    id: "8",
    title: "Mode hors-ligne PWA",
    points: 13,
    status: "todo",
    sprintId: null,
    assignee: "",
    priority: "low",
  },
];

// ── Story Card ─────────────────────────────────────────────────────────────────

function StoryCard({
  story,
  onMove,
  activeSprint,
}: {
  story: Story;
  activeSprint: Sprint | null;
  onMove: (id: string, col: StoryStatus) => void;
}) {
  const colIndex = STATUS_COLUMNS.findIndex((c) => c.id === story.status);
  return (
    <div className="border rounded-lg p-3 bg-background shadow-sm space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "size-2 mt-1 rounded-full shrink-0",
            PRIORITY_COLORS[story.priority],
          )}
        />
        <p className="text-sm font-medium flex-1 leading-tight">
          {story.title}
        </p>
        <Badge variant="outline" className="text-xs shrink-0">
          {story.points}p
        </Badge>
      </div>
      {story.assignee && (
        <p className="text-xs text-muted-foreground">@{story.assignee}</p>
      )}
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          disabled={colIndex === 0}
          onClick={() => onMove(story.id, STATUS_COLUMNS[colIndex - 1].id)}
          aria-label="Précédent"
        >
          <ChevronLeft className="size-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          disabled={colIndex === STATUS_COLUMNS.length - 1}
          onClick={() => onMove(story.id, STATUS_COLUMNS[colIndex + 1].id)}
          aria-label="Suivant"
        >
          <ChevronRight className="size-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function SprintBoard() {
  const [sprints, setSprints] = useState<Sprint[]>(INITIAL_SPRINTS);
  const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
  const [activeSprint, setActiveSprint] = useState<string>(
    INITIAL_SPRINTS[0].id,
  );
  const [view, setView] = useState<"board" | "backlog">("board");
  const [newTitle, setNewTitle] = useState("");
  const [newPoints, setNewPoints] = useState("3");

  const currentSprint = sprints.find((s) => s.id === activeSprint) ?? null;
  const sprintStories = useMemo(
    () => stories.filter((s) => s.sprintId === activeSprint),
    [stories, activeSprint],
  );
  const backlogStories = useMemo(
    () => stories.filter((s) => !s.sprintId),
    [stories],
  );

  const velocity = sprintStories
    .filter((s) => s.status === "done")
    .reduce((sum, s) => sum + s.points, 0);
  const totalPoints = sprintStories.reduce((sum, s) => sum + s.points, 0);

  const handleMove = (id: string, col: StoryStatus) => {
    setStories((p) => p.map((s) => (s.id === id ? { ...s, status: col } : s)));
  };

  const handleAddBacklog = () => {
    if (!newTitle.trim()) return;
    const story: Story = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      points: parseInt(newPoints, 10) || 3,
      status: "todo",
      sprintId: null,
      assignee: "",
      priority: "medium",
    };
    setStories((p) => [...p, story]);
    setNewTitle("");
  };

  const handleAddToSprint = (storyId: string) => {
    setStories((p) =>
      p.map((s) => (s.id === storyId ? { ...s, sprintId: activeSprint } : s)),
    );
  };

  const handleRemoveFromSprint = (storyId: string) => {
    setStories((p) =>
      p.map((s) =>
        s.id === storyId ? { ...s, sprintId: null, status: "todo" } : s,
      ),
    );
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold">Sprint Board</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={view === "board" ? "default" : "outline"}
            onClick={() => setView("board")}
            className="gap-1"
          >
            <SquareKanban className="size-4" /> Board
          </Button>
          <Button
            size="sm"
            variant={view === "backlog" ? "default" : "outline"}
            onClick={() => setView("backlog")}
            className="gap-1"
          >
            <LayoutList className="size-4" /> Backlog
          </Button>
        </div>
      </div>

      {/* Sprint selector */}
      <div className="flex gap-2 flex-wrap">
        {sprints.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={activeSprint === s.id ? "default" : "outline"}
            onClick={() => setActiveSprint(s.id)}
            className="gap-1"
          >
            <Calendar className="size-3" /> {s.name}
          </Button>
        ))}
      </div>

      {/* Sprint info */}
      {currentSprint && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 flex items-center gap-4">
          <div>
            <span className="font-medium">Objectif: </span>
            {currentSprint.goal}
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span>
              {new Date(currentSprint.startDate).toLocaleDateString("fr-FR")} →{" "}
              {new Date(currentSprint.endDate).toLocaleDateString("fr-FR")}
            </span>
            <Badge variant="secondary">
              {velocity}/{totalPoints}p complétés
            </Badge>
          </div>
        </div>
      )}

      {/* Board view */}
      {view === "board" && (
        <div className="grid grid-cols-3 gap-3">
          {STATUS_COLUMNS.map((col) => {
            const colStories = sprintStories.filter((s) => s.status === col.id);
            return (
              <div key={col.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">{col.label}</h4>
                  <Badge variant="outline" className="text-xs">
                    {colStories.length}
                  </Badge>
                </div>
                <div className="space-y-2 min-h-[100px] bg-muted/20 rounded-lg p-2">
                  {colStories.map((s) => (
                    <StoryCard
                      key={s.id}
                      story={s}
                      activeSprint={currentSprint}
                      onMove={handleMove}
                    />
                  ))}
                  {colStories.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Vide
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Backlog view */}
      {view === "backlog" && (
        <div className="space-y-4">
          {/* Sprint stories */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Dans ce sprint ({sprintStories.length})
            </h4>
            {sprintStories.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 border rounded-lg p-2"
              >
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    PRIORITY_COLORS[s.priority],
                  )}
                />
                <p className="flex-1 text-sm">{s.title}</p>
                <Badge variant="outline" className="text-xs">
                  {s.points}p
                </Badge>
                <Badge className="text-xs">
                  {STATUS_COLUMNS.find((c) => c.id === s.status)?.label}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => handleRemoveFromSprint(s.id)}
                >
                  Retirer
                </Button>
              </div>
            ))}
          </div>

          {/* Backlog */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Backlog ({backlogStories.length})
            </h4>
            {backlogStories.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 border rounded-lg p-2 bg-muted/10"
              >
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    PRIORITY_COLORS[s.priority],
                  )}
                />
                <p className="flex-1 text-sm text-muted-foreground">
                  {s.title}
                </p>
                <Badge variant="outline" className="text-xs">
                  {s.points}p
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleAddToSprint(s.id)}
                >
                  + Sprint
                </Button>
              </div>
            ))}

            {/* Add to backlog */}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Nouvelle story..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddBacklog();
                }}
                className="flex-1 h-8 text-sm"
              />
              <Input
                type="number"
                value={newPoints}
                onChange={(e) => setNewPoints(e.target.value)}
                className="w-16 h-8 text-sm text-center"
                placeholder="pts"
              />
              <Button size="sm" onClick={handleAddBacklog} className="gap-1">
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
