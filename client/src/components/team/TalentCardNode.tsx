import React from "react";
import { Handle, Position } from "@xyflow/react";
import { TeamMember } from "@/lib/scheduling/types/scheduling";
import { Badge } from "@/components/ui/badge";

interface TalentCardNodeProps {
  data: {
    member: TeamMember;
  };
}

export function TalentCardNode({ data }: TalentCardNodeProps) {
  const { member } = data;

  // Check if the user is a manager/CEO (has no manager) vs a regular employee
  const isRoot = !member.managerId;

  // The role color
  const roleColors: Record<string, string> = {
    Développement:
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    Design:
      "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
    "Gestion de projet":
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    Produit:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    Infrastructure:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    Qualité:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  };

  const deptColor =
    member.department && roleColors[member.department]
      ? roleColors[member.department]
      : "bg-primary/10 text-primary";

  return (
    <div className="group relative w-72 bg-card border shadow-sm rounded-xl overflow-hidden transition-all duration-300 hover:shadow-md hover:border-primary/50">
      {/* Top Handle - For incoming connections (only if not root) */}
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 bg-muted-foreground border-2 border-background"
        />
      )}

      {/* Header / Banner area */}
      <div
        className={`h-12 w-full ${isRoot ? "bg-primary/20" : "bg-muted/50"}`}
      />

      <div className="px-4 pb-4 pt-0 text-center relative">
        {/* Avatar */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full border-4 border-card bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={member.avatarUrl}
            alt={member.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        </div>

        <div className="mt-10 space-y-1">
          <h3 className="font-semibold text-base leading-tight">
            {member.name}
          </h3>
          <p className="text-sm text-muted-foreground">{member.role}</p>

          {member.department && (
            <div className="pt-2">
              <Badge
                variant="secondary"
                className={`${deptColor} text-xs font-medium`}
              >
                {member.department}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Handle - For outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-primary border-2 border-background"
      />
    </div>
  );
}
