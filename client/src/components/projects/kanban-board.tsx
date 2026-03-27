"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

type Priority = "low" | "medium" | "high" | "urgent";
type ColumnId = "todo" | "in-progress" | "review" | "done";

interface KanbanCard {
  id: string;
  title: string;
  assignee: string; // initials, e.g. "AL"
  priority: Priority;
  dueDate: string; // ISO date string
  column: ColumnId;
}

interface KanbanColumn {
  id: ColumnId;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS: KanbanColumn[] = [
  { id: "todo",        label: "À Faire"  },
  { id: "in-progress", label: "En Cours" },
  { id: "review",      label: "En Review"},
  { id: "done",        label: "Terminé"  },
];

const PRIORITY_DOT: Record<Priority, string> = {
  low:    "bg-green-400",
  medium: "bg-blue-400",
  high:   "bg-orange-400",
  urgent: "bg-red-500",
};

const INITIAL_CARDS: KanbanCard[] = [
  { id: "1", title: "Configurer l'authentification",  assignee: "AL", priority: "high",   dueDate: "2026-03-28", column: "todo"        },
  { id: "2", title: "Créer les migrations SQL",       assignee: "MR", priority: "medium", dueDate: "2026-03-30", column: "todo"        },
  { id: "3", title: "API REST utilisateurs",          assignee: "JD", priority: "urgent", dueDate: "2026-03-25", column: "in-progress" },
  { id: "4", title: "Composants UI dashboard",       assignee: "AL", priority: "medium", dueDate: "2026-04-02", column: "in-progress" },
  { id: "5", title: "Tests d'intégration Axum",      assignee: "MR", priority: "high",   dueDate: "2026-03-27", column: "review"      },
  { id: "6", title: "Documentation OpenAPI",          assignee: "JD", priority: "low",    dueDate: "2026-04-05", column: "done"        },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn("inline-block size-2 rounded-full shrink-0", PRIORITY_DOT[priority])}
      title={priority}
    />
  );
}

interface CardProps {
  card: KanbanCard;
  columnIndex: number;
  onMove: (id: string, direction: "left" | "right") => void;
}

function KanbanCardItem({ card, columnIndex, onMove }: CardProps) {
  const isOverdue = new Date(card.dueDate) < new Date();
  return (
    <div className="bg-background rounded-lg border shadow-sm p-3 space-y-2 hover:shadow-md hover:border-blue-200 transition-all">
      {/* Header: priority dot + title */}
      <div className="flex items-start gap-2">
        <PriorityDot priority={card.priority} />
        <p className="text-sm font-semibold leading-tight line-clamp-2 flex-1">{card.title}</p>
      </div>

      {/* Footer: assignee + due date + move buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback className="text-[10px] font-bold">{card.assignee}</AvatarFallback>
          </Avatar>
          <div className={cn("flex items-center gap-1 text-xs", isOverdue ? "text-red-600" : "text-muted-foreground")}>
            <Calendar className="size-3 shrink-0" />
            <span>{new Date(card.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={columnIndex === 0}
            onClick={() => onMove(card.id, "left")}
            aria-label="Déplacer à gauche"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={columnIndex === COLUMNS.length - 1}
            onClick={() => onMove(card.id, "right")}
            aria-label="Déplacer à droite"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function KanbanBoard() {
  const [cards, setCards] = useState<KanbanCard[]>(INITIAL_CARDS);
  const [nextId, setNextId] = useState(INITIAL_CARDS.length + 1);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [pendingColumnId, setPendingColumnId] = useState<ColumnId | null>(null);

  function moveCard(id: string, direction: "left" | "right") {
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== id) return card;
        const currentIndex = COLUMNS.findIndex((c) => c.id === card.column);
        const newIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= COLUMNS.length) return card;
        return { ...card, column: COLUMNS[newIndex].id };
      })
    );
  }

  function addCard(columnId: ColumnId) {
    setNewCardTitle('');
    setPendingColumnId(columnId);
    setShowAddCard(true);
  }

  function handleAddCardConfirm() {
    if (!newCardTitle.trim() || !pendingColumnId) return;
    const newCard: KanbanCard = {
      id: String(nextId),
      title: newCardTitle.trim(),
      assignee: "??",
      priority: "medium",
      dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0],
      column: pendingColumnId,
    };
    setCards((prev) => [...prev, newCard]);
    setNextId((n) => n + 1);
    setShowAddCard(false);
  }

  return (
    <>
    <div className="flex h-full w-full gap-4 overflow-x-auto p-4 bg-black/[0.02]">
      {COLUMNS.map((col, colIndex) => {
        const columnCards = cards.filter((c) => c.column === col.id);
        return (
          <div key={col.id} className="w-72 flex-shrink-0 flex flex-col bg-background/50 border rounded-xl overflow-hidden shadow-sm">
            {/* Column header */}
            <div className="px-4 py-3 border-b flex items-center justify-between bg-black/[0.03]">
              <h3 className="font-semibold text-sm tracking-tight">{col.label}</h3>
              <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-0.5 rounded border shadow-sm">
                {columnCards.length}
              </span>
            </div>

            {/* Cards list */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto bg-black/[0.015]">
              {columnCards.map((card) => (
                <KanbanCardItem
                  key={card.id}
                  card={card}
                  columnIndex={colIndex}
                  onMove={moveCard}
                />
              ))}
            </div>

            {/* Add card button */}
            <div className="p-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-foreground gap-1.5"
                onClick={() => addCard(col.id)}
              >
                <Plus className="size-3.5" />
                Ajouter une carte
              </Button>
            </div>
          </div>
        );
      })}
    </div>

    <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
      <DialogContent>
        <DialogHeader><DialogTitle>Titre de la carte</DialogTitle></DialogHeader>
        <Input
          value={newCardTitle}
          onChange={e => setNewCardTitle(e.target.value)}
          placeholder="Titre..."
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleAddCardConfirm(); }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAddCard(false)}>Annuler</Button>
          <Button onClick={handleAddCardConfirm} disabled={!newCardTitle.trim()}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
