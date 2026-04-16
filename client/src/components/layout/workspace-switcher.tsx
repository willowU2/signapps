"use client";

import { useTenantStore } from "@/stores/tenant-store";
import { useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AQ-SHWK — Workspace switcher.
 * Shows the current workspace and allows switching between workspaces.
 */
export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, fetchMyWorkspaces, selectWorkspace } =
    useTenantStore();

  useEffect(() => {
    if (workspaces.length === 0) {
      fetchMyWorkspaces().catch(() => {});
    }
  }, [workspaces.length, fetchMyWorkspaces]);

  if (workspaces.length <= 1 && !currentWorkspace) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-label="Changer d'espace de travail"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[120px] truncate hidden sm:inline">
            {currentWorkspace?.name ?? "Espace de travail"}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Espaces de travail
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => selectWorkspace(ws)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              currentWorkspace?.id === ws.id && "bg-accent",
            )}
          >
            <span
              className="h-4 w-4 rounded shrink-0"
              style={{ backgroundColor: ws.color ?? "hsl(var(--primary))" }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-sm">{ws.name}</span>
            {ws.is_default && (
              <Badge
                variant="outline"
                className="text-[10px] h-4 px-1 shrink-0"
              >
                Défaut
              </Badge>
            )}
            {currentWorkspace?.id === ws.id && (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => (window.location.href = "/settings")}
          className="gap-2 text-xs text-muted-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Gérer les espaces
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
