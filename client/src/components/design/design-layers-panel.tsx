"use client";

import { useRef, useState } from "react";
import {
  useDesignStore,
  useDesignObjects,
  useDesignActions,
} from "@/stores/design-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Type,
  Square,
  Image as ImageIcon,
  Group,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DesignLayersPanelProps {
  fabricCanvasRef: React.MutableRefObject<any | null>;
}

// IDEA-061: Layer lock/unlock toggle — always-visible lock icon for locked layers, syncs to fabric canvas
export default function DesignLayersPanel({
  fabricCanvasRef,
}: DesignLayersPanelProps) {
  const objects = useDesignObjects();
  const { selectedObjectIds, setSelectedObjects } = useDesignStore();
  const {
    toggleObjectLock,
    toggleObjectVisibility,
    renameObject,
    removeObject,
    reorderObjects,
    pushUndo,
  } = useDesignActions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  /** Stable ID of the object being dragged — survives array reorders */
  const dragIdRef = useRef<string | null>(null);

  const handleSelect = (id: string, e: React.MouseEvent) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (e.shiftKey) {
      const newIds = selectedObjectIds.includes(id)
        ? selectedObjectIds.filter((sid) => sid !== id)
        : [...selectedObjectIds, id];
      setSelectedObjects(newIds);
    } else {
      setSelectedObjects([id]);
      // Select on canvas
      const fObj = canvas.getObjects().find((o: any) => o.id === id);
      if (fObj) {
        canvas.setActiveObject(fObj);
        canvas.requestRenderAll();
      }
    }
  };

  const handleDoubleClick = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleRenameSubmit = (id: string) => {
    if (editName.trim()) {
      renameObject(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    pushUndo();
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      const fObj = canvas.getObjects().find((o: any) => o.id === id);
      if (fObj) canvas.remove(fObj);
      canvas.requestRenderAll();
    }
    removeObject(id);
  };

  /** Sync a specific Fabric object's z-stack position by its stable ID. */
  const syncCanvasZOrder = (objId: string, toIndex: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const fObj = canvas.getObjects().find((o: any) => o.id === objId);
    if (!fObj) return;
    if (typeof canvas.moveObjectTo === "function") {
      canvas.moveObjectTo(fObj, toIndex);
    } else if (typeof (fObj as any).moveTo === "function") {
      (fObj as any).moveTo(toIndex);
    }
    canvas.requestRenderAll();
  };

  const handleDragStart = (obj: { id: string }, index: number) => {
    dragIdRef.current = obj.id;
    setDragIndex(index);
    setDragOverIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, overIndex: number) => {
    e.preventDefault();
    const id = dragIdRef.current;
    if (!id) return;
    // Re-resolve the current index from the latest `objects` array each time
    // (index prop may be stale after a previous reorder in the same drag).
    const currentIndex = objects.findIndex((o) => o.id === id);
    if (currentIndex === -1 || currentIndex === overIndex) {
      setDragOverIndex(overIndex);
      return;
    }
    reorderObjects(currentIndex, overIndex);
    syncCanvasZOrder(id, overIndex);
    setDragIndex(overIndex);
    setDragOverIndex(overIndex);
  };

  const handleDragEnd = () => {
    dragIdRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (overIndex: number) => {
    const id = dragIdRef.current;
    if (!id) {
      setDragOverIndex(null);
      return;
    }
    const currentIndex = objects.findIndex((o) => o.id === id);
    if (currentIndex !== -1 && currentIndex !== overIndex) {
      reorderObjects(currentIndex, overIndex);
      syncCanvasZOrder(id, overIndex);
    }
    dragIdRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "text":
        return <Type className="h-3.5 w-3.5" />;
      case "image":
        return <ImageIcon className="h-3.5 w-3.5" />;
      case "group":
        return <Group className="h-3.5 w-3.5" />;
      default:
        return <Square className="h-3.5 w-3.5" />;
    }
  };

  // Reverse to show top layers first
  const reversedObjects = [...objects].reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Layers
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {reversedObjects.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No layers yet. Add elements from the toolbar.
          </div>
        ) : (
          <div className="py-1">
            {reversedObjects.map((obj, displayIdx) => {
              const realIdx = objects.length - 1 - displayIdx;
              const isSelected = selectedObjectIds.includes(obj.id);
              return (
                <div
                  key={obj.id}
                  draggable
                  onDragStart={() => handleDragStart(obj, realIdx)}
                  onDragOver={(e) => handleDragOver(e, realIdx)}
                  onDragEnd={handleDragEnd}
                  onDrop={() => handleDrop(realIdx)}
                  onClick={(e) => handleSelect(obj.id, e)}
                  onDoubleClick={() => handleDoubleClick(obj.id, obj.name)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer transition-all duration-150 group",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50",
                    !obj.visible && "opacity-40",
                    dragIndex === realIdx &&
                      "opacity-60 ring-1 ring-primary/40 bg-primary/5",
                    dragOverIndex === realIdx &&
                      dragIndex !== realIdx &&
                      "before:content-[''] before:absolute before:left-0 before:right-0 before:-top-px before:h-0.5 before:bg-primary before:rounded-full",
                  )}
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground/50 cursor-grab shrink-0" />
                  <span className="shrink-0 text-muted-foreground">
                    {getIcon(obj.type)}
                  </span>

                  {editingId === obj.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRenameSubmit(obj.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit(obj.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="h-5 text-xs flex-1 px-1"
                    />
                  ) : (
                    <span className="flex-1 truncate">{obj.name}</span>
                  )}

                  <div className="flex items-center gap-0.5">
                    {/* Lock icon: always visible when locked, hover for unlock toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleObjectLock(obj.id);
                        // Sync locked state to fabric canvas
                        const canvas = fabricCanvasRef.current;
                        if (canvas) {
                          const fObj = canvas
                            .getObjects()
                            .find((o: any) => o.id === obj.id);
                          if (fObj) {
                            const nowLocked = !obj.locked;
                            fObj.set({
                              selectable: !nowLocked,
                              evented: !nowLocked,
                              hasControls: !nowLocked,
                              lockMovementX: nowLocked,
                              lockMovementY: nowLocked,
                            });
                            if (nowLocked && canvas.getActiveObject() === fObj)
                              canvas.discardActiveObject();
                            canvas.requestRenderAll();
                          }
                        }
                      }}
                      className={cn(
                        "p-0.5 rounded hover:bg-muted transition-opacity",
                        obj.locked
                          ? "opacity-100 text-amber-500"
                          : "opacity-0 group-hover:opacity-100",
                      )}
                      title={obj.locked ? "Unlock" : "Lock"}
                    >
                      {obj.locked ? (
                        <Lock className="h-3 w-3" />
                      ) : (
                        <Unlock className="h-3 w-3" />
                      )}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleObjectVisibility(obj.id);
                        }}
                        className="p-0.5 rounded hover:bg-muted"
                        title={obj.visible ? "Hide" : "Show"}
                      >
                        {obj.visible ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(obj.id);
                        }}
                        className="p-0.5 rounded hover:bg-destructive/10"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
