"use client";

// Feature 2: HR employee → show assigned projects

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Briefcase, Clock } from "lucide-react";

interface AssignedProject {
  id: string;
  name: string;
  role: string;
  allocation: number;
  progress: number;
  status: "active" | "on-hold" | "completed";
  dueDate: string;
}

const STATUS_CONFIG = {
  active: { label: "Actif", class: "bg-green-100 text-green-800" },
  "on-hold": { label: "En pause", class: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Terminé", class: "bg-gray-100 text-gray-800" },
};

const DEMO_PROJECTS: AssignedProject[] = [
  { id: "p1", name: "Refonte Backend Auth", role: "Lead Dev", allocation: 80, progress: 62, status: "active", dueDate: "2026-05-01" },
  { id: "p2", name: "Dashboard Analytics", role: "Reviewer", allocation: 20, progress: 35, status: "active", dueDate: "2026-06-15" },
  { id: "p3", name: "Migration PostgreSQL", role: "Dev", allocation: 0, progress: 100, status: "completed", dueDate: "2026-02-28" },
];

interface EmployeeProjectsProps {
  employeeId?: string;
  employeeName?: string;
}

export function EmployeeProjects({ employeeName = "Alice Martin" }: EmployeeProjectsProps) {
  const [projects] = useState<AssignedProject[]>(DEMO_PROJECTS);
  const active = projects.filter((p) => p.status === "active");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Briefcase className="size-4" />
          Projets de {employeeName}
        </CardTitle>
        <Badge variant="secondary">{active.length} actifs</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.map((p) => (
          <div key={p.id} className="space-y-1.5 rounded-lg border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{p.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CONFIG[p.status].class}`}>
                {STATUS_CONFIG[p.status].label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{p.role}</span>
              <span className="flex items-center gap-1"><Clock className="size-3" />{p.allocation}% alloué</span>
              <span>Échéance: {new Date(p.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
            </div>
            {p.status !== "completed" && (
              <div className="flex items-center gap-2">
                <Progress value={p.progress} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground">{p.progress}%</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
