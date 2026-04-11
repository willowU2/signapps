"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTeamStore } from "@/stores/team-store";

interface TeamFilterToggleProps {
  /** The module identifier used as the filter key (e.g. "calendar", "tasks") */
  module: string;
}

/**
 * Reusable toggle button that filters any module's view to show only
 * the current manager's team members.
 *
 * Only renders when the current user has direct reports (`hasReports === true`).
 */
export function TeamFilterToggle({ module }: TeamFilterToggleProps) {
  const hasReports = useTeamStore((s) => s.hasReports);
  const isActive = useTeamStore((s) => s.isTeamFilterActive(module));
  const toggleTeamFilter = useTeamStore((s) => s.toggleTeamFilter);

  if (!hasReports) return null;

  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      className={cn(
        "gap-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "text-muted-foreground hover:text-foreground",
      )}
      onClick={() => toggleTeamFilter(module)}
      title={isActive ? "Afficher tout" : "Filtrer par mon équipe"}
    >
      <Users className="h-4 w-4" />
      Mon équipe
    </Button>
  );
}
