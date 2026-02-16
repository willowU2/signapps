import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Check } from "lucide-react";
import { useResources, ResourceConflict } from "@/hooks/use-resources";

interface ResourceSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedResourceIds: string[];
  onResourcesSelected: (resourceIds: string[]) => void;
  startTime?: string;
  endTime?: string;
  resourceType?: "room" | "equipment" | "vehicle";
}

export function ResourceSelector({
  open,
  onOpenChange,
  selectedResourceIds,
  onResourcesSelected,
  startTime,
  endTime,
  resourceType,
}: ResourceSelectorProps) {
  const { resources, loadResources, loadResourcesByType, checkAvailability } =
    useResources();
  const [localSelected, setLocalSelected] = useState<string[]>(selectedResourceIds);
  const [conflicts, setConflicts] = useState<Map<string, ResourceConflict[]>>(
    new Map()
  );
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (open) {
      if (resourceType) {
        loadResourcesByType(resourceType);
      } else {
        loadResources();
      }
    }
  }, [open, resourceType, loadResources, loadResourcesByType]);

  useEffect(() => {
    setLocalSelected(selectedResourceIds);
  }, [selectedResourceIds]);

  // Check availability when resources or times change
  useEffect(() => {
    if (startTime && endTime && localSelected.length > 0 && open) {
      checkAvailabilityForSelected();
    } else {
      setConflicts(new Map());
    }
  }, [startTime, endTime, localSelected, open]);

  const checkAvailabilityForSelected = async () => {
    if (!startTime || !endTime || localSelected.length === 0) return;

    try {
      setChecking(true);
      const result = await checkAvailability(localSelected, startTime, endTime);
      if (result) {
        const conflictMap = new Map<string, ResourceConflict[]>();
        result.conflicts.forEach((c) => {
          if (!conflictMap.has(c.resource_id)) {
            conflictMap.set(c.resource_id, []);
          }
          conflictMap.get(c.resource_id)!.push(c);
        });
        setConflicts(conflictMap);
      }
    } finally {
      setChecking(false);
    }
  };

  const toggleResource = (resourceId: string) => {
    setLocalSelected((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId]
    );
  };

  const handleConfirm = () => {
    onResourcesSelected(localSelected);
    onOpenChange(false);
  };

  const typeColors: Record<string, string> = {
    room: "bg-blue-100 text-blue-800",
    equipment: "bg-purple-100 text-purple-800",
    vehicle: "bg-green-100 text-green-800",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Resources</DialogTitle>
          <DialogDescription>
            Choose resources to book for this event
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resource list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {resources.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                No resources available
              </div>
            ) : (
              resources.map((resource) => {
                const resourceConflicts = conflicts.get(resource.id) || [];
                const isConflicted = resourceConflicts.length > 0;

                return (
                  <div
                    key={resource.id}
                    className="flex items-start gap-3 p-3 rounded border hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={localSelected.includes(resource.id)}
                      onCheckedChange={() => toggleResource(resource.id)}
                      disabled={!resource.is_available}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {resource.name}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            typeColors[resource.type]
                          }`}
                        >
                          {resource.type}
                        </span>
                      </div>

                      {resource.location && (
                        <p className="text-xs text-muted-foreground">
                          📍 {resource.location}
                        </p>
                      )}

                      {resource.capacity && (
                        <p className="text-xs text-muted-foreground">
                          👥 Capacity: {resource.capacity}
                        </p>
                      )}

                      {!resource.is_available && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ Currently unavailable
                        </p>
                      )}

                      {isConflicted && startTime && endTime && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-xs">
                          <div className="flex gap-1 items-center text-red-700 font-medium mb-1">
                            <AlertCircle className="h-3 w-3" />
                            Conflicts detected:
                          </div>
                          {resourceConflicts.map((conflict) => (
                            <div
                              key={conflict.conflicting_event_id}
                              className="text-red-600 text-xs ml-4"
                            >
                              • {conflict.conflicting_event_title}
                              {" "}
                              <span className="text-red-500">
                                ({new Date(conflict.conflicting_start).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {localSelected.includes(resource.id) && (
                      <Check className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Summary */}
          {localSelected.length > 0 && (
            <div className="p-3 bg-blue-50 rounded text-sm">
              <p className="text-blue-900">
                <strong>{localSelected.length}</strong> resource(s) selected
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="flex-1" disabled={checking}>
              {checking ? "Checking..." : "Confirm"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
