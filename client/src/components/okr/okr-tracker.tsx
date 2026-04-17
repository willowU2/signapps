"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, Plus, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type OKRStatus = "on-track" | "at-risk" | "off-track";

interface KeyResult {
  id: string;
  title: string;
  progress: number; // 0-100
  owner: string; // initials
  status: OKRStatus;
}

interface Objective {
  id: string;
  title: string;
  keyResults: KeyResult[];
  owner: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  OKRStatus,
  { color: string; label: string; bgColor: string }
> = {
  "on-track": {
    color: "text-green-700",
    label: "On Track",
    bgColor: "bg-green-50",
  },
  "at-risk": {
    color: "text-yellow-700",
    label: "At Risk",
    bgColor: "bg-yellow-50",
  },
  "off-track": {
    color: "text-red-700",
    label: "Off Track",
    bgColor: "bg-red-50",
  },
};

const INITIAL_OBJECTIVES: Objective[] = [
  {
    id: "obj-1",
    title: "Deliver MVP Platform",
    owner: "AL",
    keyResults: [
      {
        id: "kr-1",
        title: "Backend API 100% complete",
        progress: 85,
        owner: "MR",
        status: "on-track",
      },
      {
        id: "kr-2",
        title: "Frontend UI components",
        progress: 75,
        owner: "AL",
        status: "on-track",
      },
      {
        id: "kr-3",
        title: "User authentication flow",
        progress: 100,
        owner: "JD",
        status: "on-track",
      },
    ],
  },
  {
    id: "obj-2",
    title: "Improve System Performance",
    owner: "MR",
    keyResults: [
      {
        id: "kr-4",
        title: "API latency < 100ms",
        progress: 60,
        owner: "MR",
        status: "at-risk",
      },
      {
        id: "kr-5",
        title: "Database query optimization",
        progress: 40,
        owner: "JD",
        status: "off-track",
      },
    ],
  },
  {
    id: "obj-3",
    title: "Achieve 95% Test Coverage",
    owner: "JD",
    keyResults: [
      {
        id: "kr-6",
        title: "Unit tests coverage",
        progress: 92,
        owner: "JD",
        status: "on-track",
      },
      {
        id: "kr-7",
        title: "Integration tests",
        progress: 70,
        owner: "AL",
        status: "at-risk",
      },
    ],
  },
];

// ── Helper Functions ───────────────────────────────────────────────────────────

const getStatusBadgeVariant = (
  status: OKRStatus,
): "default" | "secondary" | "destructive" => {
  switch (status) {
    case "on-track":
      return "default";
    case "at-risk":
      return "secondary";
    case "off-track":
      return "destructive";
  }
};

const getProgressBarColor = (status: OKRStatus): string => {
  switch (status) {
    case "on-track":
      return "bg-green-500";
    case "at-risk":
      return "bg-yellow-500";
    case "off-track":
      return "bg-red-500";
  }
};

const getInitials = (name: string): string => {
  return name.toUpperCase().slice(0, 2);
};

// ── Components ─────────────────────────────────────────────────────────────────

interface KeyResultItemProps {
  kr: KeyResult;
}

const KeyResultItem: React.FC<KeyResultItemProps> = ({ kr }) => (
  <div className="space-y-2 rounded-lg bg-muted/50 p-3">
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{kr.title}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{kr.progress}%</span>
          <Badge variant={getStatusBadgeVariant(kr.status)} className="text-xs">
            {STATUS_CONFIG[kr.status].label}
          </Badge>
        </div>
      </div>
      <Avatar className="shrink-0">
        <AvatarFallback>{kr.owner}</AvatarFallback>
      </Avatar>
    </div>
    <Progress value={kr.progress} className="h-2" />
  </div>
);

interface ObjectiveCardProps {
  objective: Objective;
  onDelete: (id: string) => void;
}

const ObjectiveCard: React.FC<ObjectiveCardProps> = ({
  objective,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const avgProgress = Math.round(
    objective.keyResults.reduce((sum, kr) => sum + kr.progress, 0) /
      objective.keyResults.length,
  );

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center justify-between gap-4 border-b px-6 py-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform text-muted-foreground",
                  !isOpen && "-rotate-90",
                )}
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold truncate">{objective.title}</h3>
                <p className="text-xs text-muted-foreground">
                  Avg Progress: {avgProgress}% • {objective.keyResults.length}{" "}
                  Key Results
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {objective.owner}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(objective.id);
                }}
                className="text-destructive hover:bg-destructive/10"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="px-6 py-4 space-y-3">
          {objective.keyResults.map((kr) => (
            <KeyResultItem key={kr.id} kr={kr} />
          ))}
          {objective.keyResults.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No key results yet
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

interface ObjectiveFormProps {
  onAdd: (objective: Objective) => void;
}

const ObjectiveForm: React.FC<ObjectiveFormProps> = ({ onAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !owner.trim()) return;

    const newObjective: Objective = {
      id: `obj-${Date.now()}`,
      title: title.trim(),
      owner: owner.trim().toUpperCase(),
      keyResults: [],
    };

    onAdd(newObjective);
    setTitle("");
    setOwner("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full"
        variant="outline"
      >
        <Plus className="h-4 w-4" />
        Add Objective
      </Button>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">New Objective</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <Input
            placeholder="e.g., Improve System Performance"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Owner (Initials)</label>
          <Input
            placeholder="e.g., JD"
            value={owner}
            onChange={(e) => setOwner(e.target.value.toUpperCase())}
            maxLength={2}
            onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || !owner.trim()}
          >
            Create
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export interface OKRTrackerProps {
  initialObjectives?: Objective[];
}

export const OKRTracker: React.FC<OKRTrackerProps> = ({
  initialObjectives = INITIAL_OBJECTIVES,
}) => {
  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);

  const handleAddObjective = (objective: Objective) => {
    setObjectives([...objectives, objective]);
  };

  const handleDeleteObjective = (id: string) => {
    setObjectives(objectives.filter((obj) => obj.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-1">OKR Tracker</h2>
        <p className="text-sm text-muted-foreground">
          {objectives.length} objectives •{" "}
          {objectives.reduce((sum, obj) => sum + obj.keyResults.length, 0)} key
          results
        </p>
      </div>

      <div className="space-y-3">
        {objectives.map((objective) => (
          <ObjectiveCard
            key={objective.id}
            objective={objective}
            onDelete={handleDeleteObjective}
          />
        ))}
      </div>

      <ObjectiveForm onAdd={handleAddObjective} />
    </div>
  );
};
