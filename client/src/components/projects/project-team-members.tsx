"use client";

// Feature 1: Project → show team members from HR

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ExternalLink, Mail } from "lucide-react";

interface HRMember {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  status: "active" | "remote" | "away";
  skills: string[];
  allocation: number; // % allocated to this project
}

const STATUS_COLOR: Record<HRMember["status"], string> = {
  active: "bg-green-500",
  remote: "bg-blue-500",
  away: "bg-yellow-500",
};

const DEMO_MEMBERS: HRMember[] = [
  { id: "1", name: "Alice Martin", role: "Lead Developer", department: "Technologie", email: "alice.martin@signapps.io", status: "active", skills: ["React", "TypeScript", "Rust"], allocation: 80 },
  { id: "2", name: "Bob Dupont", role: "DevOps Engineer", department: "Technologie", email: "bob.dupont@signapps.io", status: "remote", skills: ["Docker", "Kubernetes"], allocation: 50 },
  { id: "5", name: "Emma Leroy", role: "Designer UX/UI", department: "Technologie", email: "emma.leroy@signapps.io", status: "active", skills: ["Figma", "Design System"], allocation: 30 },
];

interface ProjectTeamMembersProps {
  projectId?: string;
  projectName?: string;
}

export function ProjectTeamMembers({ projectName = "Sprint Alpha" }: ProjectTeamMembersProps) {
  const [members] = useState<HRMember[]>(DEMO_MEMBERS);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" />
          Equipe — {projectName}
        </CardTitle>
        <Badge variant="secondary">{members.length} membres</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-lg border p-2">
            <div className="relative">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{m.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
              </Avatar>
              <span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${STATUS_COLOR[m.status]}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{m.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{m.allocation}%</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{m.role} · {m.department}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.skills.slice(0, 3).map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] py-0 h-4">{s}</Badge>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="size-7 shrink-0" asChild>
              <a href={`mailto:${m.email}`}><Mail className="size-3.5" /></a>
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1">
          <ExternalLink className="size-3.5" />
          Voir dans l'annuaire RH
        </Button>
      </CardContent>
    </Card>
  );
}
