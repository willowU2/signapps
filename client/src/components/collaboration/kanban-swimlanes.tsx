"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, Layers } from "lucide-react";

interface KanbanCard {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
}

interface Column {
  id: string;
  title: string;
  cards: KanbanCard[];
}

interface Swimlane {
  id: string;
  label: string;
  color: string;
  columns: Column[];
}

const COLUMN_TEMPLATES = ["To Do", "In Progress", "Review", "Done"];

const PRIORITY_COLORS = {
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

const defaultLanes = (): Swimlane[] => [
  {
    id: "lane-1",
    label: "Frontend",
    color: "#6366f1",
    columns: COLUMN_TEMPLATES.map((t) => ({
      id: `${t}-fe`,
      title: t,
      cards: [],
    })),
  },
  {
    id: "lane-2",
    label: "Backend",
    color: "#22c55e",
    columns: COLUMN_TEMPLATES.map((t) => ({
      id: `${t}-be`,
      title: t,
      cards: [],
    })),
  },
];

export function KanbanSwimlanes() {
  const [lanes, setLanes] = useState<Swimlane[]>(defaultLanes);
  const [newLaneLabel, setNewLaneLabel] = useState("");
  const [addingLane, setAddingLane] = useState(false);
  const [addingCard, setAddingCard] = useState<{
    laneId: string;
    colId: string;
  } | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  const addLane = () => {
    if (!newLaneLabel) return;
    const LANE_COLORS = ["#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
    const color = LANE_COLORS[lanes.length % LANE_COLORS.length];
    setLanes((prev) => [
      ...prev,
      {
        id: `lane-${Date.now()}`,
        label: newLaneLabel,
        color,
        columns: COLUMN_TEMPLATES.map((t) => ({
          id: `${t}-${Date.now()}`,
          title: t,
          cards: [],
        })),
      },
    ]);
    setNewLaneLabel("");
    setAddingLane(false);
  };

  const removeLane = (laneId: string) =>
    setLanes((prev) => prev.filter((l) => l.id !== laneId));

  const addCard = () => {
    if (!addingCard || !newCardTitle) return;
    const priorities: KanbanCard["priority"][] = ["low", "medium", "high"];
    const card: KanbanCard = {
      id: `card-${Date.now()}`,
      title: newCardTitle,
      priority: priorities[Math.floor(Math.random() * 3)],
    };
    setLanes((prev) =>
      prev.map((l) =>
        l.id !== addingCard.laneId
          ? l
          : {
              ...l,
              columns: l.columns.map((c) =>
                c.id !== addingCard.colId
                  ? c
                  : { ...c, cards: [...c.cards, card] },
              ),
            },
      ),
    );
    setNewCardTitle("");
    setAddingCard(null);
  };

  const moveCard = (
    card: KanbanCard,
    fromLaneId: string,
    fromColId: string,
    toLaneId: string,
    toColId: string,
  ) => {
    setLanes((prev) =>
      prev.map((l) => {
        if (l.id === fromLaneId) {
          return {
            ...l,
            columns: l.columns.map((c) =>
              c.id === fromColId
                ? { ...c, cards: c.cards.filter((ca) => ca.id !== card.id) }
                : c,
            ),
          };
        }
        if (l.id === toLaneId) {
          return {
            ...l,
            columns: l.columns.map((c) =>
              c.id === toColId ? { ...c, cards: [...c.cards, card] } : c,
            ),
          };
        }
        return l;
      }),
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-5 w-5 text-primary" />
            Kanban with Swimlanes
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddingLane(!addingLane)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Swimlane
          </Button>
        </div>
        {addingLane && (
          <div className="flex gap-2 mt-2">
            <Input
              value={newLaneLabel}
              onChange={(e) => setNewLaneLabel(e.target.value)}
              placeholder="Swimlane name"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addLane()}
            />
            <Button size="sm" onClick={addLane}>
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAddingLane(false)}
            >
              Annuler
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* Column headers */}
          <div
            className="grid min-w-[700px]"
            style={{
              gridTemplateColumns: `120px repeat(${COLUMN_TEMPLATES.length}, 1fr)`,
            }}
          >
            <div />
            {COLUMN_TEMPLATES.map((col) => (
              <div
                key={col}
                className="px-2 py-1.5 text-xs font-semibold text-center bg-muted rounded-t-lg mx-0.5"
              >
                {col}
              </div>
            ))}
          </div>

          {/* Swimlanes */}
          <div className="min-w-[700px] space-y-2 mt-1">
            {lanes.map((lane) => (
              <div
                key={lane.id}
                className="grid"
                style={{
                  gridTemplateColumns: `120px repeat(${lane.columns.length}, 1fr)`,
                }}
              >
                {/* Lane header */}
                <div
                  className="flex items-center gap-1.5 px-2 py-2 rounded-l-lg text-white text-sm font-semibold"
                  style={{ backgroundColor: lane.color }}
                >
                  <GripVertical className="h-3.5 w-3.5 opacity-60" />
                  <span className="truncate">{lane.label}</span>
                  <button
                    onClick={() => removeLane(lane.id)}
                    className="ml-auto opacity-60 hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {/* Columns */}
                {lane.columns.map((col) => (
                  <div
                    key={col.id}
                    className="min-h-[80px] bg-muted/30 border-t border-b border-r last:rounded-r-lg mx-0.5 p-1.5 space-y-1.5"
                  >
                    {col.cards.map((card) => (
                      <div
                        key={card.id}
                        className="bg-card border rounded-lg p-2 text-xs shadow-sm"
                      >
                        <p className="font-medium leading-tight">
                          {card.title}
                        </p>
                        <Badge
                          className={`mt-1 text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[card.priority]}`}
                          variant="outline"
                        >
                          {card.priority}
                        </Badge>
                      </div>
                    ))}
                    {addingCard?.laneId === lane.id &&
                    addingCard?.colId === col.id ? (
                      <div className="space-y-1">
                        <Input
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          placeholder="Card title"
                          className="h-7 text-xs"
                          onKeyDown={(e) => e.key === "Enter" && addCard()}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-6 text-xs"
                            onClick={addCard}
                          >
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            onClick={() => setAddingCard(null)}
                          >
                            X
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingCard({ laneId: lane.id, colId: col.id });
                          setNewCardTitle("");
                        }}
                        className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
