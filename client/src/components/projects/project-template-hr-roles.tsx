"use client";

// Feature 17: Project template → include HR role assignments

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface HRRoleAssignment {
  id: string;
  roleName: string;
  department: string;
  allocation: number; // %
  requiredSkills: string[];
  count: number; // headcount needed
}

interface TemplateWithRoles {
  id: string;
  name: string;
  category: string;
  roleAssignments: HRRoleAssignment[];
}

const DEPARTMENTS = ["Technologie", "Commercial", "Finance", "RH", "Marketing"];
const SKILLS_POOL = ["React", "TypeScript", "Rust", "Docker", "Figma", "CRM", "PostgreSQL", "Python"];

const DEMO_TEMPLATES: TemplateWithRoles[] = [
  {
    id: "t1", name: "Projet Web Standard", category: "Développement",
    roleAssignments: [
      { id: "ra1", roleName: "Lead Developer", department: "Technologie", allocation: 80, requiredSkills: ["React", "TypeScript"], count: 1 },
      { id: "ra2", roleName: "Designer UX", department: "Technologie", allocation: 50, requiredSkills: ["Figma"], count: 1 },
      { id: "ra3", roleName: "DevOps", department: "Technologie", allocation: 30, requiredSkills: ["Docker"], count: 1 },
    ],
  },
];

export function ProjectTemplateHRRoles() {
  const [templates, setTemplates] = useState<TemplateWithRoles[]>(DEMO_TEMPLATES);
  const [activeTemplate, setActiveTemplate] = useState<string>(DEMO_TEMPLATES[0].id);
  const [newRole, setNewRole] = useState({ roleName: "", department: DEPARTMENTS[0], allocation: 50, count: 1 });

  const current = templates.find((t) => t.id === activeTemplate);

  function addRole() {
    if (!newRole.roleName) return;
    setTemplates((prev) => prev.map((t) => t.id === activeTemplate ? {
      ...t,
      roleAssignments: [...t.roleAssignments, { id: `ra-${Date.now()}`, ...newRole, requiredSkills: [] }],
    } : t));
    setNewRole({ roleName: "", department: DEPARTMENTS[0], allocation: 50, count: 1 });
  }

  function removeRole(roleId: string) {
    setTemplates((prev) => prev.map((t) => t.id === activeTemplate ? {
      ...t,
      roleAssignments: t.roleAssignments.filter((r) => r.id !== roleId),
    } : t));
  }

  function applyTemplate() {
    if (!current) return;
    const total = current.roleAssignments.reduce((acc, r) => acc + r.count, 0);
    toast.success(`Template appliqué`, { description: `${total} rôle(s) RH pré-assignés au nouveau projet.` });
  }

  if (!current) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="size-4" />
            Rôles RH du template
          </CardTitle>
          <Badge variant="secondary">{current.roleAssignments.length} rôles</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={activeTemplate} onValueChange={setActiveTemplate}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="space-y-1.5">
          {current.roleAssignments.map((role) => (
            <div key={role.id} className="flex items-center gap-2 rounded border px-2 py-1.5">
              <Users className="size-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{role.roleName}</span>
                  <Badge variant="outline" className="text-[10px] py-0 h-4">x{role.count}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{role.department} · {role.allocation}% alloué</p>
              </div>
              <Button variant="ghost" size="icon" className="size-6 text-destructive" onClick={() => removeRole(role.id)}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input value={newRole.roleName} onChange={(e) => setNewRole((p) => ({ ...p, roleName: e.target.value }))}
            placeholder="Nouveau rôle..." className="h-7 text-xs flex-1" />
          <Select value={newRole.department} onValueChange={(v) => setNewRole((p) => ({ ...p, department: v }))}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" className="h-7 px-2" onClick={addRole}><Plus className="size-3.5" /></Button>
        </div>

        <Button className="w-full h-7 text-xs gap-1" onClick={applyTemplate}>
          <FolderOpen className="size-3.5" /> Appliquer au projet
        </Button>
      </CardContent>
    </Card>
  );
}
