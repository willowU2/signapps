"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  name: string;
  initials: string;
  capacity: number; // hours/week
  allocations: Allocation[];
}

interface Allocation {
  projectId: string;
  projectName: string;
  hours: number; // hours/week
  color: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
];

const INITIAL_MEMBERS: Member[] = [
  {
    id: "1",
    name: "Alice Martin",
    initials: "AL",
    capacity: 40,
    allocations: [
      {
        projectId: "p1",
        projectName: "SignApps Auth",
        hours: 20,
        color: "bg-blue-500",
      },
      {
        projectId: "p2",
        projectName: "Dashboard UI",
        hours: 10,
        color: "bg-green-500",
      },
    ],
  },
  {
    id: "2",
    name: "Jean Dupont",
    initials: "JD",
    capacity: 40,
    allocations: [
      {
        projectId: "p1",
        projectName: "SignApps Auth",
        hours: 16,
        color: "bg-blue-500",
      },
      {
        projectId: "p3",
        projectName: "Mobile App",
        hours: 20,
        color: "bg-purple-500",
      },
    ],
  },
  {
    id: "3",
    name: "Marie Renard",
    initials: "MR",
    capacity: 32,
    allocations: [
      {
        projectId: "p2",
        projectName: "Dashboard UI",
        hours: 24,
        color: "bg-green-500",
      },
    ],
  },
];

// ── Capacity Bar ───────────────────────────────────────────────────────────

function CapacityBar({ member }: { member: Member }) {
  const used = member.allocations.reduce((s, a) => s + a.hours, 0);
  const pct = Math.min((used / member.capacity) * 100, 100);
  const over = used > member.capacity;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {used}h / {member.capacity}h par semaine
        </span>
        <span
          className={cn(
            "font-semibold",
            over
              ? "text-destructive"
              : pct > 80
                ? "text-amber-600"
                : "text-green-600",
          )}
        >
          {over
            ? `Surchargé +${used - member.capacity}h`
            : `${member.capacity - used}h libre`}
        </span>
      </div>

      {/* Stacked allocation bar */}
      <div className="h-5 rounded bg-muted overflow-hidden flex">
        {member.allocations.map((a) => (
          <div
            key={a.projectId}
            className={cn("h-full transition-all relative group", a.color)}
            style={{ width: `${(a.hours / member.capacity) * 100}%` }}
            title={`${a.projectName}: ${a.hours}h`}
          >
            {(a.hours / member.capacity) * 100 > 8 && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {a.hours}h
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ResourceAllocation() {
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [addingMember, setAddingMember] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCapacity, setNewCapacity] = useState("40");

  const handleAddMember = () => {
    if (!newName.trim()) return;
    const initials = newName
      .trim()
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const member: Member = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      initials,
      capacity: parseInt(newCapacity, 10) || 40,
      allocations: [],
    };
    setMembers((p) => [...p, member]);
    setNewName("");
    setNewCapacity("40");
    setAddingMember(false);
  };

  const handleRemoveMember = (id: string) =>
    setMembers((p) => p.filter((m) => m.id !== id));

  const handleUpdateHours = (
    memberId: string,
    projectId: string,
    hours: number,
  ) => {
    setMembers((p) =>
      p.map((m) =>
        m.id !== memberId
          ? m
          : {
              ...m,
              allocations: m.allocations.map((a) =>
                a.projectId === projectId ? { ...a, hours } : a,
              ),
            },
      ),
    );
  };

  // Collect all unique projects
  const allProjects = Array.from(
    new Map(
      members
        .flatMap((m) => m.allocations)
        .map((a) => [
          a.projectId,
          { id: a.projectId, name: a.projectName, color: a.color },
        ]),
    ).values(),
  );

  const totalCapacity = members.reduce((s, m) => s + m.capacity, 0);
  const totalUsed = members.reduce(
    (s, m) => s + m.allocations.reduce((ss, a) => ss + a.hours, 0),
    0,
  );

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="size-4" /> Allocation des ressources
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Total: {totalUsed}h / {totalCapacity}h
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddingMember(true)}
            className="gap-1"
          >
            <Plus className="size-3" /> Membre
          </Button>
        </div>
      </div>

      {/* Legend */}
      {allProjects.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {allProjects.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 text-xs">
              <span className={cn("size-3 rounded-sm shrink-0", p.color)} />
              {p.name}
            </div>
          ))}
        </div>
      )}

      {/* Members */}
      <div className="space-y-4">
        {members.map((m) => (
          <div key={m.id} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {m.initials}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  Capacité: {m.capacity}h/sem
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveMember(m.id)}
                aria-label="Supprimer"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>

            <CapacityBar member={m} />

            {/* Allocation details */}
            {m.allocations.length > 0 && (
              <div className="space-y-1">
                {m.allocations.map((a) => (
                  <div
                    key={a.projectId}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={cn("size-2 rounded-full shrink-0", a.color)}
                    />
                    <span className="flex-1 truncate text-muted-foreground">
                      {a.projectName}
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max={m.capacity}
                      value={a.hours}
                      onChange={(e) =>
                        handleUpdateHours(
                          m.id,
                          a.projectId,
                          parseInt(e.target.value, 10) || 0,
                        )
                      }
                      className="w-16 h-6 text-xs text-center px-1"
                    />
                    <span className="text-xs text-muted-foreground">h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add member form */}
      {addingMember && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <p className="text-xs font-medium">Nouveau membre</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nom complet"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="h/sem"
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              className="w-20 h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleAddMember}>
              Ajouter
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setAddingMember(false)}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
