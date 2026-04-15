"use client";

// Feature 18: HR department → show department projects dashboard

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Users, Briefcase, Clock } from "lucide-react";

interface DeptProject {
  id: string;
  name: string;
  status: "active" | "on-hold" | "completed";
  progress: number;
  teamSize: number;
  totalHours: number;
  budget: number;
  spentBudget: number;
  lead: string;
}

interface Department {
  id: string;
  name: string;
  headCount: number;
  projects: DeptProject[];
}

const DEPARTMENTS: Department[] = [
  {
    id: "tech",
    name: "Technologie",
    headCount: 12,
    projects: [
      {
        id: "p1",
        name: "Refonte Backend Auth",
        status: "active",
        progress: 62,
        teamSize: 4,
        totalHours: 320,
        budget: 45000,
        spentBudget: 28000,
        lead: "Alice Martin",
      },
      {
        id: "p2",
        name: "Dashboard Analytics",
        status: "active",
        progress: 35,
        teamSize: 3,
        totalHours: 180,
        budget: 22000,
        spentBudget: 8000,
        lead: "Emma Leroy",
      },
      {
        id: "p3",
        name: "Migration PostgreSQL",
        status: "completed",
        progress: 100,
        teamSize: 2,
        totalHours: 120,
        budget: 15000,
        spentBudget: 14200,
        lead: "Marc Dubois",
      },
    ],
  },
  {
    id: "commercial",
    name: "Commercial",
    headCount: 8,
    projects: [
      {
        id: "p4",
        name: "CRM Migration",
        status: "active",
        progress: 45,
        teamSize: 3,
        totalHours: 200,
        budget: 18000,
        spentBudget: 9000,
        lead: "Claire Bernard",
      },
    ],
  },
];

const STATUS_CONFIG = {
  active: { label: "Actif", class: "bg-green-100 text-green-800" },
  "on-hold": { label: "Pause", class: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Terminé", class: "bg-muted text-gray-800" },
};

export function DepartmentProjectsDashboard() {
  const [selectedDept, setSelectedDept] = useState<string>("tech");
  const dept = DEPARTMENTS.find((d) => d.id === selectedDept);

  if (!dept) return null;

  const active = dept.projects.filter((p) => p.status === "active");
  const totalHours = dept.projects.reduce((acc, p) => acc + p.totalHours, 0);
  const totalBudget = dept.projects.reduce((acc, p) => acc + p.budget, 0);
  const spentBudget = dept.projects.reduce((acc, p) => acc + p.spentBudget, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4" />
            Dashboard département
          </CardTitle>
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-muted/50 p-2">
            <Users className="size-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-bold">{dept.headCount}</p>
            <p className="text-[10px] text-muted-foreground">Effectif</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <Briefcase className="size-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-bold">{active.length}</p>
            <p className="text-[10px] text-muted-foreground">Projets actifs</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <Clock className="size-3.5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-bold">{totalHours}h</p>
            <p className="text-[10px] text-muted-foreground">Total heures</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-sm font-bold">
              {Math.round((spentBudget / totalBudget) * 100)}%
            </p>
            <p className="text-[10px] text-muted-foreground">Budget cons.</p>
          </div>
        </div>

        <div className="space-y-2">
          {dept.projects.map((p) => (
            <div key={p.id} className="rounded-lg border p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate">{p.name}</span>
                <span
                  className={`text-[10px] rounded-full px-1.5 py-0.5 shrink-0 ${STATUS_CONFIG[p.status].class}`}
                >
                  {STATUS_CONFIG[p.status].label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{p.lead}</span>
                <span>·</span>
                <span>{p.teamSize} membres</span>
                <span>·</span>
                <span>{p.totalHours}h</span>
              </div>
              {p.status !== "completed" && (
                <div className="flex items-center gap-2">
                  <Progress value={p.progress} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground w-8">
                    {p.progress}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
