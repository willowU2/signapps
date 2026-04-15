"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AVAILABLE_RESOURCES, type ResourceKey } from "@/hooks/use-roles";
import type { RolePermissions } from "@/lib/api/identity";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface PermissionsEditorProps {
  value: RolePermissions;
  onChange: (permissions: RolePermissions) => void;
  disabled?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  read: "Lire",
  create: "Créer",
  update: "Modifier",
  delete: "Supprimer",
  start: "Démarrer",
  stop: "Arrêter",
  share: "Partager",
  manage_members: "Gérer membres",
  test: "Tester",
  run: "Exécuter",
  send: "Envoyer",
  manage_channels: "Gérer canaux",
  export: "Exporter",
};

export function PermissionsEditor({
  value,
  onChange,
  disabled,
}: PermissionsEditorProps) {
  const [openResources, setOpenResources] = useState<Set<string>>(new Set());

  const toggleResource = (resource: string) => {
    const newOpen = new Set(openResources);
    if (newOpen.has(resource)) {
      newOpen.delete(resource);
    } else {
      newOpen.add(resource);
    }
    setOpenResources(newOpen);
  };

  const isActionEnabled = (resource: string, action: string): boolean => {
    return value[resource]?.includes(action) ?? false;
  };

  const toggleAction = (resource: string, action: string) => {
    if (disabled) return;

    const currentActions = value[resource] || [];
    let newActions: string[];

    if (currentActions.includes(action)) {
      newActions = currentActions.filter((a) => a !== action);
    } else {
      newActions = [...currentActions, action];
    }

    const newPermissions = { ...value };
    if (newActions.length === 0) {
      delete newPermissions[resource];
    } else {
      newPermissions[resource] = newActions;
    }

    onChange(newPermissions);
  };

  const toggleAllActions = (
    resource: ResourceKey,
    actions: readonly string[],
  ) => {
    if (disabled) return;

    const currentActions = value[resource] || [];
    const allEnabled = actions.every((a) => currentActions.includes(a));

    const newPermissions = { ...value };
    if (allEnabled) {
      delete newPermissions[resource];
    } else {
      newPermissions[resource] = [...actions];
    }

    onChange(newPermissions);
  };

  const getEnabledCount = (resource: string, totalActions: number): number => {
    return value[resource]?.length || 0;
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Permissions</Label>
      <div className="border rounded-lg divide-y">
        {AVAILABLE_RESOURCES.map((resource) => {
          const enabledCount = getEnabledCount(
            resource.key,
            resource.actions.length,
          );
          const isOpen = openResources.has(resource.key);
          const allEnabled = enabledCount === resource.actions.length;

          return (
            <Collapsible
              key={resource.key}
              open={isOpen}
              onOpenChange={() => toggleResource(resource.key)}
            >
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                    <span className="font-medium text-sm">
                      {resource.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {enabledCount > 0 && (
                      <Badge
                        variant={allEnabled ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {enabledCount}/{resource.actions.length}
                      </Badge>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-3 pt-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Checkbox
                      id={`${resource.key}-all`}
                      checked={allEnabled}
                      onCheckedChange={() =>
                        toggleAllActions(resource.key, resource.actions)
                      }
                      disabled={disabled}
                    />
                    <label
                      htmlFor={`${resource.key}-all`}
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Tout sélectionner
                    </label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {resource.actions.map((action) => (
                      <div key={action} className="flex items-center gap-2">
                        <Checkbox
                          id={`${resource.key}-${action}`}
                          checked={isActionEnabled(resource.key, action)}
                          onCheckedChange={() =>
                            toggleAction(resource.key, action)
                          }
                          disabled={disabled}
                        />
                        <label
                          htmlFor={`${resource.key}-${action}`}
                          className="text-sm cursor-pointer"
                        >
                          {ACTION_LABELS[action] || action}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
