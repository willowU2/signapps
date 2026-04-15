"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Person, PersonRole } from "@/types/org";

interface PersonCardProps {
  person: Person;
  roles?: PersonRole[];
  primaryPosition?: string;
  site?: string;
  onClick?: () => void;
  className?: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  employee: {
    label: "Employé",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  client_contact: {
    label: "Client",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  supplier_contact: {
    label: "Fournisseur",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  partner: {
    label: "Partenaire",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  },
};

function getInitials(person: Person): string {
  return `${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`.toUpperCase();
}

export function PersonCard({
  person,
  roles = [],
  primaryPosition,
  site,
  onClick,
  className,
}: PersonCardProps) {
  const activeRoles = roles.filter((r) => r.is_active);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg bg-card border border-border transition-colors",
        onClick && "cursor-pointer hover:bg-muted/60",
        !person.is_active && "opacity-60",
        className,
      )}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0">
        {person.avatar_url && (
          <AvatarImage
            src={person.avatar_url}
            alt={`${person.first_name} ${person.last_name}`}
          />
        )}
        <AvatarFallback className="text-sm font-semibold bg-muted">
          {getInitials(person)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">
            {person.first_name} {person.last_name}
          </p>
          {!person.is_active && (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 text-muted-foreground"
            >
              Inactif
            </Badge>
          )}
        </div>

        {person.email && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {person.email}
          </p>
        )}

        {primaryPosition && (
          <p className="text-xs text-foreground/80 truncate mt-0.5">
            {primaryPosition}
          </p>
        )}

        {site && (
          <p className="text-xs text-muted-foreground truncate">{site}</p>
        )}

        {/* Role badges */}
        {activeRoles.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            {activeRoles.map((role) => {
              const cfg = ROLE_CONFIG[role.role_type] ?? {
                label: role.role_type,
                color: "bg-muted text-muted-foreground",
              };
              return (
                <span
                  key={role.id}
                  className={cn(
                    "inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    cfg.color,
                  )}
                >
                  {cfg.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Linked user indicator */}
      {person.user_id && (
        <div
          className="h-2 w-2 rounded-full bg-green-500 shrink-0 mt-1.5"
          title="Compte utilisateur lié"
        />
      )}
    </div>
  );
}
