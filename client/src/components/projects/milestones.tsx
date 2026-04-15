"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type MilestoneStatus = "On Track" | "At Risk" | "Overdue";

interface Milestone {
  id: string;
  name: string;
  targetDate: string; // ISO date string
  owner: string; // initials, e.g. "AL"
  status: MilestoneStatus;
  progress: number; // 0-100
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MilestoneStatus,
  { color: string; icon: React.ReactNode; textClass: string }
> = {
  "On Track": {
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle2 className="size-4" />,
    textClass: "text-green-700",
  },
  "At Risk": {
    color: "bg-yellow-100 text-yellow-800",
    icon: <AlertCircle className="size-4" />,
    textClass: "text-yellow-700",
  },
  Overdue: {
    color: "bg-red-100 text-red-800",
    icon: <AlertCircle className="size-4" />,
    textClass: "text-red-700",
  },
};

const INITIAL_MILESTONES: Milestone[] = [
  {
    id: "1",
    name: "Authentification complète",
    targetDate: "2026-03-28",
    owner: "AL",
    status: "On Track",
    progress: 85,
  },
  {
    id: "2",
    name: "API REST utilisateurs",
    targetDate: "2026-03-25",
    owner: "JD",
    status: "Overdue",
    progress: 60,
  },
  {
    id: "3",
    name: "Dashboard UI",
    targetDate: "2026-04-05",
    owner: "MR",
    status: "On Track",
    progress: 45,
  },
  {
    id: "4",
    name: "Système de notifications",
    targetDate: "2026-04-15",
    owner: "AL",
    status: "At Risk",
    progress: 30,
  },
  {
    id: "5",
    name: "Tests d'intégration",
    targetDate: "2026-04-10",
    owner: "JD",
    status: "On Track",
    progress: 25,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: MilestoneStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge className={cn("gap-1.5", config.color)} variant="outline">
      {config.icon}
      <span>{status}</span>
    </Badge>
  );
}

interface ProgressBarProps {
  progress: number;
}

function ProgressBar({ progress }: ProgressBarProps) {
  const getColor = (p: number) => {
    if (p >= 75) return "bg-green-500";
    if (p >= 50) return "bg-blue-500";
    if (p >= 25) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            getColor(progress),
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-muted-foreground w-8 text-right">
        {progress}%
      </span>
    </div>
  );
}

interface MilestoneRowProps {
  milestone: Milestone;
  onRemove: (id: string) => void;
}

function MilestoneRow({ milestone, onRemove }: MilestoneRowProps) {
  const isOverdue = new Date(milestone.targetDate) < new Date();
  const daysUntil = Math.ceil(
    (new Date(milestone.targetDate).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return (
    <div className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow bg-background">
      {/* Header: name and status badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold flex-1 line-clamp-1">
          {milestone.name}
        </h3>
        <StatusBadge status={milestone.status} />
      </div>

      {/* Progress bar */}
      <ProgressBar progress={milestone.progress} />

      {/* Footer: owner, date, remove button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback className="text-[10px] font-bold">
              {milestone.owner}
            </AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs",
              isOverdue ? "text-red-600 font-medium" : "text-muted-foreground",
            )}
          >
            <Calendar className="size-3 shrink-0" />
            <span>
              {new Date(milestone.targetDate).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            {!isOverdue && daysUntil >= 0 && (
              <span className="text-muted-foreground">({daysUntil}j)</span>
            )}
            {isOverdue && (
              <span className="text-red-600 font-medium">
                ({Math.abs(daysUntil)}j retard)
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onRemove(milestone.id)}
          aria-label="Supprimer le jalon"
          className="text-muted-foreground hover:text-destructive"
        >
          ×
        </Button>
      </div>
    </div>
  );
}

interface AddMilestoneFormProps {
  onAdd: (milestone: Milestone) => void;
  nextId: number;
}

function AddMilestoneForm({ onAdd, nextId }: AddMilestoneFormProps) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !owner.trim() || !targetDate) return;

    const newMilestone: Milestone = {
      id: String(nextId),
      name: name.trim(),
      owner: owner.trim().toUpperCase(),
      targetDate,
      status: "On Track",
      progress: 0,
    };

    onAdd(newMilestone);
    setName("");
    setOwner("");
    setTargetDate("");
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start text-muted-foreground hover:text-foreground gap-1.5"
        onClick={() => setIsOpen(true)}
      >
        <Plus className="size-4" />
        Ajouter un jalon
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-lg p-4 space-y-3 bg-background/50"
    >
      <div className="space-y-2">
        <label className="text-xs font-medium">Nom du jalon</label>
        <Input
          placeholder="ex: Authentification"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium">Propriétaire (initiales)</label>
        <Input
          placeholder="ex: AL"
          value={owner}
          onChange={(e) => setOwner(e.target.value.toUpperCase())}
          maxLength={3}
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium">Date cible</label>
        <Input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          required
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1">
          Créer
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setIsOpen(false)}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function Milestones() {
  const [milestones, setMilestones] = useState<Milestone[]>(INITIAL_MILESTONES);
  const [nextId, setNextId] = useState(INITIAL_MILESTONES.length + 1);

  const handleAdd = (milestone: Milestone) => {
    setMilestones((prev) => [...prev, milestone]);
    setNextId((n) => n + 1);
  };

  const handleRemove = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  const onTrackCount = milestones.filter((m) => m.status === "On Track").length;
  const atRiskCount = milestones.filter((m) => m.status === "At Risk").length;
  const overdueCount = milestones.filter((m) => m.status === "Overdue").length;

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-semibold">Jalons</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {onTrackCount} en cours • {atRiskCount} à risque • {overdueCount} en
            retard
          </p>
        </div>
      </div>

      {/* Milestones list */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {milestones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun jalon pour le moment
          </div>
        ) : (
          milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              onRemove={handleRemove}
            />
          ))
        )}
      </div>

      {/* Add milestone form */}
      <div className="pt-2">
        <AddMilestoneForm onAdd={handleAdd} nextId={nextId} />
      </div>
    </div>
  );
}
