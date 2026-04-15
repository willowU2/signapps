"use client";
import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { DealCard } from "./deal-card";
import type { Deal, DealStage } from "@/lib/api/crm";

const STAGES: { id: DealStage; label: string; colorClass: string }[] = [
  { id: "prospect", label: "Prospect", colorClass: "border-t-slate-400" },
  { id: "qualified", label: "Qualifié", colorClass: "border-t-blue-400" },
  { id: "proposal", label: "Proposition", colorClass: "border-t-amber-400" },
  {
    id: "negotiation",
    label: "Négociation",
    colorClass: "border-t-orange-400",
  },
  { id: "won", label: "Gagné", colorClass: "border-t-emerald-500" },
];

interface ColumnProps {
  stage: (typeof STAGES)[0];
  deals: Deal[];
}

function DroppableColumn({ stage, deals }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const weightedTotal = deals.reduce(
    (s, d) => s + (d.value * d.probability) / 100,
    0,
  );

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-52 flex flex-col rounded-lg border-t-2 ${stage.colorClass} bg-muted/20 transition-colors ${
        isOver ? "bg-primary/5 ring-2 ring-primary/20" : ""
      }`}
    >
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <span className="font-semibold text-sm">{stage.label}</span>
        <Badge variant="outline" className="text-xs tabular-nums">
          {deals.length}
        </Badge>
      </div>

      <div className="p-2 space-y-2 flex-1 min-h-48">
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <div className="h-24 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed rounded-md">
            Déposez ici
          </div>
        )}
      </div>

      {deals.length > 0 && (
        <div className="px-3 py-2 border-t text-xs text-muted-foreground text-right">
          {new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(weightedTotal)}{" "}
          pondéré
        </div>
      )}
    </div>
  );
}

interface Props {
  deals: Deal[];
  onMove: (id: string, stage: DealStage) => void;
}

export function DealKanban({ deals, onMove }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || e.active.id === e.over.id) return;
    // Check if dropped on a stage column
    const targetStage = STAGES.find((s) => s.id === e.over!.id);
    if (targetStage) {
      onMove(String(e.active.id), targetStage.id);
    }
  };

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <DroppableColumn
            key={stage.id}
            stage={stage}
            deals={deals.filter((d) => d.stage === stage.id)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
        {activeDeal ? <DealCard deal={activeDeal} compact /> : null}
      </DragOverlay>
    </DndContext>
  );
}
