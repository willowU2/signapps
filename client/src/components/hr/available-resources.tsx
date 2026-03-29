"use client";

// Feature 27: HR → show available resources for project assignment

import { useState, useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Search, UserPlus, Users, Filter } from "lucide-react";
import { toast } from "sonner";

interface ResourceEmployee {
  id: string;
  name: string;
  role: string;
  department: string;
  skills: string[];
  currentAllocation: number;
  maxAllocation: number;
  availableFrom: string;
}

const DEMO_RESOURCES: ResourceEmployee[] = [
  { id: "1", name: "Alice Martin", role: "Lead Dev", department: "Tech", skills: ["React", "TypeScript", "Rust"], currentAllocation: 80, maxAllocation: 100, availableFrom: "2026-04-01" },
  { id: "2", name: "Bob Dupont", role: "DevOps", department: "Tech", skills: ["Docker", "Kubernetes"], currentAllocation: 50, maxAllocation: 100, availableFrom: "2026-03-29" },
  { id: "5", name: "Emma Leroy", role: "Designer", department: "Tech", skills: ["Figma", "Design System"], currentAllocation: 30, maxAllocation: 80, availableFrom: "2026-03-29" },
  { id: "8", name: "Marc Dubois", role: "Backend Dev", department: "Tech", skills: ["Rust", "PostgreSQL"], currentAllocation: 60, maxAllocation: 100, availableFrom: "2026-04-07" },
  { id: "7", name: "Nadia Rousseau", role: "RH Manager", department: "RH", skills: ["Recrutement", "SIRH"], currentAllocation: 90, maxAllocation: 100, availableFrom: "2026-05-01" },
];

function getAvailableCapacity(emp: ResourceEmployee) {
  return emp.maxAllocation - emp.currentAllocation;
}

interface AvailableResourcesProps {
  requiredSkills?: string[];
  minCapacity?: number;
  onAssign?: (employeeId: string, employeeName: string) => void;
}

export function AvailableResources({ requiredSkills = [], minCapacity = 10, onAssign }: AvailableResourcesProps) {
  const [search, setSearch] = useState("");
  const [assigned, setAssigned] = useState<Set<string>>(new Set());

  const resources = useMemo(() => {
    return DEMO_RESOURCES
      .filter((e) => {
        const capacity = getAvailableCapacity(e);
        if (capacity < minCapacity) return false;
        if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.role.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .map((e) => {
        const capacity = getAvailableCapacity(e);
        const skillMatch = requiredSkills.length > 0
          ? requiredSkills.filter((s) => e.skills.includes(s)).length / requiredSkills.length * 100
          : 100;
        return { ...e, capacity, skillMatch: Math.round(skillMatch) };
      })
      .sort((a, b) => b.skillMatch - a.skillMatch || b.capacity - a.capacity);
  }, [search, minCapacity, requiredSkills]);

  function handleAssign(emp: typeof resources[0]) {
    setAssigned((prev) => new Set([...prev, emp.id]));
    onAssign?.(emp.id, emp.name);
    toast.success(`${emp.name} assigné(e) au projet`, { description: `${emp.capacity}% de capacité disponible.` });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Ressources disponibles
          </CardTitle>
          <Badge variant="secondary">{resources.length} disponibles</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-8 h-8 text-xs" />
        </div>

        {requiredSkills.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
            <Filter className="size-3" /> Compétences recherchées:
            {requiredSkills.map((s) => <Badge key={s} variant="outline" className="text-[10px] py-0 h-4">{s}</Badge>)}
          </div>
        )}

        <div className="space-y-2">
          {resources.map((emp) => (
            <div key={emp.id} className="flex items-center gap-2.5 rounded-lg border p-2">
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="text-xs">{emp.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{emp.name}</span>
                  {requiredSkills.length > 0 && (
                    <Badge variant={emp.skillMatch >= 70 ? "default" : "secondary"} className="text-[10px] py-0 h-4">
                      {emp.skillMatch}% match
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">{emp.role} · {emp.department}</p>
                <div className="flex items-center gap-2">
                  <Progress value={emp.currentAllocation} className="h-1 flex-1" />
                  <span className="text-[10px] text-muted-foreground shrink-0">{emp.capacity}% dispo</span>
                </div>
              </div>
              <Button
                size="sm"
                variant={assigned.has(emp.id) ? "secondary" : "outline"}
                className="h-7 gap-1 shrink-0 text-[10px]"
                onClick={() => handleAssign(emp)}
                disabled={assigned.has(emp.id)}
              >
                {assigned.has(emp.id) ? "Assigné" : <><UserPlus className="size-3" /> Assigner</>}
              </Button>
            </div>
          ))}
          {resources.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Aucune ressource disponible.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
