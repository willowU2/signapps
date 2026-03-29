"use client";

// Feature 30: Unified workspace: project + team + tasks + calendar in one view

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Users, CheckSquare, Calendar, Bell, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceProject {
  id: string;
  name: string;
  status: "active" | "at_risk" | "completed";
  progress: number;
  dueDate: string;
}

interface WorkspaceMember {
  id: string;
  name: string;
  role: string;
  status: "active" | "remote" | "away" | "leave";
  tasksToday: number;
}

interface WorkspaceTask {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  status: "todo" | "in_progress" | "done";
  projectName: string;
}

interface WorkspaceEvent {
  id: string;
  title: string;
  time: string;
  type: "meeting" | "deadline" | "leave" | "review";
  participants: string[];
}

const STATUS_DOT: Record<WorkspaceMember["status"], string> = {
  active: "bg-green-500", remote: "bg-blue-500", away: "bg-yellow-500", leave: "bg-red-500",
};

const PRIORITY_COLOR = { high: "text-red-600", medium: "text-yellow-600", low: "text-gray-400" };
const TASK_STATUS_CLASS = {
  todo: "border-border",
  in_progress: "border-blue-300 bg-blue-50/30",
  done: "border-green-200 bg-green-50/30 opacity-60",
};

const PROJECTS: WorkspaceProject[] = [
  { id: "p1", name: "Refonte Backend Auth", status: "active", progress: 62, dueDate: "2026-05-01" },
  { id: "p2", name: "Dashboard Analytics", status: "at_risk", progress: 35, dueDate: "2026-06-15" },
];

const MEMBERS: WorkspaceMember[] = [
  { id: "1", name: "Alice Martin", role: "Lead Dev", status: "active", tasksToday: 3 },
  { id: "2", name: "Bob Dupont", role: "DevOps", status: "remote", tasksToday: 2 },
  { id: "5", name: "Emma Leroy", role: "Designer", status: "leave", tasksToday: 0 },
  { id: "8", name: "Marc Dubois", role: "Backend Dev", status: "active", tasksToday: 4 },
];

const TODAY_TASKS: WorkspaceTask[] = [
  { id: "t1", title: "Implémenter endpoint POST /auth", assignee: "Alice", dueDate: "2026-03-29", priority: "high", status: "in_progress", projectName: "Backend Auth" },
  { id: "t2", title: "Review PR #42", assignee: "Marc", dueDate: "2026-03-29", priority: "medium", status: "todo", projectName: "Backend Auth" },
  { id: "t3", title: "Fix chart rendering bug", assignee: "Emma", dueDate: "2026-03-29", priority: "high", status: "todo", projectName: "Analytics" },
  { id: "t4", title: "Update CI pipeline", assignee: "Bob", dueDate: "2026-03-29", priority: "low", status: "done", projectName: "Backend Auth" },
];

const TODAY_EVENTS: WorkspaceEvent[] = [
  { id: "e1", title: "Daily Standup", time: "09:00", type: "meeting", participants: ["Alice", "Bob", "Marc"] },
  { id: "e2", title: "Sprint Review", time: "14:00", type: "review", participants: ["Alice", "Emma", "Bob", "Marc"] },
  { id: "e3", title: "Emma Leroy — Congé", time: "Toute la journée", type: "leave", participants: ["Emma"] },
];

const EVENT_COLOR = { meeting: "bg-blue-100 text-blue-800", deadline: "bg-red-100 text-red-800", leave: "bg-orange-100 text-orange-800", review: "bg-purple-100 text-purple-800" };

export function UnifiedWorkspace() {
  const [tasks, setTasks] = useState<WorkspaceTask[]>(TODAY_TASKS);

  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? {
      ...t, status: t.status === "done" ? "todo" : "done" as WorkspaceTask["status"]
    } : t));
  }

  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const totalTasks = tasks.length;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="size-5" />
            Espace de travail unifié
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-center">
            <Briefcase className="size-4 mx-auto mb-1 text-blue-600" />
            <p className="text-sm font-bold text-blue-700">{PROJECTS.length}</p>
            <p className="text-[10px] text-blue-600">Projets</p>
          </div>
          <div className="rounded-lg bg-green-50 p-2 text-center">
            <Users className="size-4 mx-auto mb-1 text-green-600" />
            <p className="text-sm font-bold text-green-700">{MEMBERS.filter((m) => m.status !== "leave").length}</p>
            <p className="text-[10px] text-green-600">Disponibles</p>
          </div>
          <div className="rounded-lg bg-purple-50 p-2 text-center">
            <CheckSquare className="size-4 mx-auto mb-1 text-purple-600" />
            <p className="text-sm font-bold text-purple-700">{completedTasks}/{totalTasks}</p>
            <p className="text-[10px] text-purple-600">Tâches</p>
          </div>
          <div className="rounded-lg bg-orange-50 p-2 text-center">
            <Calendar className="size-4 mx-auto mb-1 text-orange-600" />
            <p className="text-sm font-bold text-orange-700">{TODAY_EVENTS.length}</p>
            <p className="text-[10px] text-orange-600">Événements</p>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="h-7 text-xs">
            <TabsTrigger value="overview" className="text-xs px-2">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs px-2">Tâches</TabsTrigger>
            <TabsTrigger value="team" className="text-xs px-2">Équipe</TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs px-2">Agenda</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3 space-y-3">
            {/* Projects */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Briefcase className="size-3" /> Projets actifs
              </p>
              {PROJECTS.map((p) => (
                <div key={p.id} className="flex items-center gap-2 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{p.name}</span>
                      {p.status === "at_risk" && <AlertTriangle className="size-3 text-yellow-500 shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Progress value={p.progress} className="h-1 flex-1" />
                      <span className="text-[10px] text-muted-foreground">{p.progress}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Separator />
            {/* Today events preview */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Calendar className="size-3" /> Aujourd'hui
              </p>
              {TODAY_EVENTS.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 mb-1">
                  <span className={cn("text-[10px] rounded px-1.5 py-0.5 shrink-0", EVENT_COLOR[ev.type])}>{ev.time}</span>
                  <span className="text-xs truncate">{ev.title}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-3">
            <ScrollArea className="max-h-64">
              <div className="space-y-1.5">
                {tasks.map((task) => (
                  <div key={task.id} className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-2", TASK_STATUS_CLASS[task.status])}>
                    <input type="checkbox" checked={task.status === "done"} onChange={() => toggleTask(task.id)} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-xs font-medium", task.status === "done" && "line-through text-muted-foreground")}>{task.title}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                        <span className={PRIORITY_COLOR[task.priority]}>● {task.priority}</span>
                        <span>· {task.assignee}</span>
                        <span>· {task.projectName}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-2 flex items-center gap-2">
              <Progress value={(completedTasks / totalTasks) * 100} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground">{completedTasks}/{totalTasks}</span>
            </div>
          </TabsContent>

          <TabsContent value="team" className="mt-3">
            <div className="space-y-2">
              {MEMBERS.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <div className="relative">
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[10px]">{m.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <span className={cn("absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-white", STATUS_DOT[m.status])} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{m.name}</div>
                    <div className="text-[10px] text-muted-foreground">{m.role}</div>
                  </div>
                  {m.status !== "leave" ? (
                    <Badge variant="secondary" className="text-[10px] h-4">{m.tasksToday} tâches</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 text-orange-600">Absent</Badge>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-3">
            <div className="space-y-2">
              {TODAY_EVENTS.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2.5 rounded-lg border p-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0", EVENT_COLOR[ev.type])}>{ev.time}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{ev.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {ev.participants.map((p) => (
                        <span key={p} className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
