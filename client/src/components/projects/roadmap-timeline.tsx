"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string;
  title: string;
  date: string; // ISO date
  status: "planned" | "in-progress" | "completed";
}

interface ProjectLane {
  id: string;
  name: string;
  color: string; // tailwind color class
  milestones: Milestone[];
}

interface RoadmapTimelineProps {
  lanes: ProjectLane[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const SAMPLE_LANES: ProjectLane[] = [
  {
    id: "mobile",
    name: "Mobile App",
    color: "border-blue-500",
    milestones: [
      { id: "m1", title: "Authentication", date: "2026-Q1", status: "completed" },
      { id: "m2", title: "UI Framework", date: "2026-Q2", status: "in-progress" },
      { id: "m3", title: "Push Notifications", date: "2026-Q3", status: "planned" },
    ],
  },
  {
    id: "backend",
    name: "Backend API",
    color: "border-green-500",
    milestones: [
      { id: "b1", title: "Core Services", date: "2026-Q1", status: "completed" },
      { id: "b2", title: "Database Optimization", date: "2026-Q2", status: "completed" },
      { id: "b3", title: "Caching Layer", date: "2026-Q3", status: "planned" },
    ],
  },
  {
    id: "frontend",
    name: "Web Frontend",
    color: "border-purple-500",
    milestones: [
      { id: "f1", title: "Component Library", date: "2026-Q1", status: "completed" },
      { id: "f2", title: "Dashboard", date: "2026-Q2", status: "in-progress" },
      { id: "f3", title: "Analytics", date: "2026-Q3", status: "planned" },
    ],
  },
];

const QUARTERS = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];

const STATUS_CONFIG = {
  planned: {
    diamond: "border-2 border-gray-300 bg-gray-50",
    label: "Planifié",
  },
  "in-progress": {
    diamond: "border-2 border-amber-400 bg-amber-100",
    label: "En Cours",
  },
  completed: {
    diamond: "border-2 border-green-500 bg-green-100",
    label: "Terminé",
  },
};

// ── Milestone Diamond ─────────────────────────────────────────────────────

function MilestoneDiamond({ milestone }: { milestone: Milestone }) {
  const config = STATUS_CONFIG[milestone.status];
  const isQuarter = milestone.date.includes("Q");

  return (
    <div className="flex flex-col items-center gap-1 group">
      {/* Diamond shape */}
      <div
        className={cn(
          "w-4 h-4 rotate-45 transition-all",
          config.diamond,
          "group-hover:scale-125 group-hover:shadow-lg"
        )}
        title={`${milestone.title} - ${config.label}`}
      />

      {/* Tooltip */}
      <div className="hidden group-hover:flex absolute bg-popover text-popover-foreground text-xs rounded border shadow-lg p-2 whitespace-nowrap z-20 bottom-full mb-1">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{milestone.title}</span>
          <span className="text-muted-foreground">{isQuarter ? milestone.date : new Date(milestone.date).toLocaleDateString("fr-FR")}</span>
        </div>
      </div>
    </div>
  );
}

// ── Quarter Header ────────────────────────────────────────────────────────

function QuarterHeader() {
  return (
    <div className="flex items-end">
      {QUARTERS.map((q) => (
        <div key={q} className="flex-1 text-center pb-4 border-b font-semibold text-sm text-muted-foreground">
          {q}
        </div>
      ))}
    </div>
  );
}

// ── Project Lane ──────────────────────────────────────────────────────────

function ProjectLaneRow({ lane }: { lane: ProjectLane }) {
  const milestonsByQuarter = useMemo(() => {
    const map: Record<string, Milestone[]> = {};
    QUARTERS.forEach((q) => (map[q] = []));
    lane.milestones.forEach((m) => {
      const quarter = m.date.includes("Q") ? m.date : `${m.date.substring(0, 4)}-Q${Math.ceil(parseInt(m.date.substring(5, 7)) / 3)}`;
      if (map[quarter]) {
        map[quarter].push(m);
      }
    });
    return map;
  }, [lane.milestones]);

  return (
    <div className={cn("border-l-4 bg-muted/20", lane.color)}>
      <div className="flex">
        {/* Lane label */}
        <div className="w-32 p-4 font-semibold text-sm border-r flex items-center shrink-0">
          {lane.name}
        </div>

        {/* Timeline cells */}
        <div className="flex flex-1">
          {QUARTERS.map((q) => (
            <div
              key={q}
              className="flex-1 border-r p-4 flex items-center justify-center gap-3 relative"
            >
              {milestonsByQuarter[q].map((m) => (
                <MilestoneDiamond key={m.id} milestone={m} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RoadmapTimeline({ lanes = SAMPLE_LANES }: RoadmapTimelineProps) {
  return (
    <div className="w-full border rounded-lg overflow-hidden bg-background">
      {/* Title */}
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-semibold">Project Roadmap</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Milestones across project phases. Hover for details.
        </p>
      </div>

      {/* Timeline container */}
      <div className="overflow-x-auto">
        {/* Header with quarters */}
        <div className="flex">
          <div className="w-32 shrink-0" />
          <div className="flex-1">
            <QuarterHeader />
          </div>
        </div>

        {/* Lanes */}
        <div className="divide-y">
          {lanes.map((lane) => (
            <ProjectLaneRow key={lane.id} lane={lane} />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t bg-muted/30 text-xs flex items-center gap-6">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rotate-45", config.diamond)} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
