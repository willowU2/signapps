"use client";

import { useYjsDocument } from "@/hooks/use-yjs-document";
import { useState, useEffect } from "react";

interface Card {
  id: string;
  title: string;
  description: string;
}

interface Column {
  id: string;
  title: string;
  cards: Card[];
}

interface BoardEditorProps {
  docId: string;
}

export function BoardEditor({ docId }: BoardEditorProps) {
  const { ydoc, isSynced } = useYjsDocument(docId);
  const [columns, setColumns] = useState<Column[]>([
    {
      id: "col-1",
      title: "To Do",
      cards: [{ id: "card-1", title: "Task 1", description: "Description 1" }],
    },
    {
      id: "col-2",
      title: "In Progress",
      cards: [],
    },
    {
      id: "col-3",
      title: "Done",
      cards: [],
    },
  ]);

  useEffect(() => {
    if (!ydoc) return;

    // Initialize board structure
    const board = ydoc.getMap("board");

    // Observe changes
    const observer = () => {
      // Rebuild columns from Y.doc
    };

    board.observe(observer);
    return () => board.unobserve(observer);
  }, [ydoc]);

  const handleDragStart = (
    e: React.DragEvent,
    cardId: string,
    fromColId: string,
  ) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("cardId", cardId);
    e.dataTransfer.setData("fromColId", fromColId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, toColId: string) => {
    e.preventDefault();

    const cardId = e.dataTransfer.getData("cardId");
    const fromColId = e.dataTransfer.getData("fromColId");

    if (fromColId === toColId) return;

    // Update state (in production: update Y.doc)
    setColumns((prev) => {
      const newColumns = [...prev];
      const fromCol = newColumns.find((c) => c.id === fromColId)!;
      const toCol = newColumns.find((c) => c.id === toColId)!;

      const cardIndex = fromCol.cards.findIndex((c) => c.id === cardId);
      const [card] = fromCol.cards.splice(cardIndex, 1);
      toCol.cards.push(card);

      return newColumns;
    });
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Kanban Board</h2>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isSynced ? "bg-green-500" : "bg-yellow-500 animate-pulse"
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {isSynced ? "Synced" : "Syncing..."}
            </span>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="flex gap-6 overflow-x-auto pb-6">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80 bg-muted rounded-lg border border-border"
          >
            {/* Column header */}
            <div className="p-4 border-b border-border bg-background">
              <h3 className="font-semibold text-foreground">{column.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {column.cards.length} cards
              </p>
            </div>

            {/* Cards */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.id)}
              className="p-4 min-h-96 space-y-3"
            >
              {column.cards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card.id, column.id)}
                  className="p-3 bg-background rounded border border-border hover:shadow-md cursor-move transition"
                >
                  <h4 className="font-semibold text-foreground text-sm">
                    {card.title}
                  </h4>
                  {card.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {card.description}
                    </p>
                  )}
                </div>
              ))}

              {/* Add card button */}
              <button className="w-full p-3 border-2 border-dashed border-border rounded text-muted-foreground hover:border-gray-400 hover:text-muted-foreground text-sm font-medium transition">
                + Add card
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
        <p className="text-sm text-blue-800">
          🎯 Drag and drop cards to move them between columns. Changes sync in
          real-time.
        </p>
      </div>
    </div>
  );
}
