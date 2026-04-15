"use client";

import { useState } from "react";
import { X, Plus, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RetroCard {
  id: string;
  content: string;
  votes: number;
  anonymous: boolean;
}

interface RetroColumn {
  keep: RetroCard[];
  stop: RetroCard[];
  start: RetroCard[];
}

export default function SprintRetro() {
  const [retro, setRetro] = useState<RetroColumn>({
    keep: [
      { id: "k1", content: "Daily standups", votes: 5, anonymous: false },
      { id: "k2", content: "Code reviews", votes: 3, anonymous: false },
    ],
    stop: [
      { id: "s1", content: "Unnecessary meetings", votes: 4, anonymous: true },
      { id: "s2", content: "Late deployments", votes: 2, anonymous: false },
    ],
    start: [
      { id: "st1", content: "Automated testing", votes: 6, anonymous: false },
      { id: "st2", content: "Better documentation", votes: 3, anonymous: true },
    ],
  });

  const [newCards, setNewCards] = useState({ keep: "", stop: "", start: "" });

  const addCard = (column: "keep" | "stop" | "start", content: string) => {
    if (content.trim()) {
      const newCard: RetroCard = {
        id: `${column}-${Date.now()}`,
        content,
        votes: 0,
        anonymous: Math.random() > 0.5,
      };
      setRetro((prev) => ({
        ...prev,
        [column]: [...prev[column], newCard],
      }));
      setNewCards((prev) => ({ ...prev, [column]: "" }));
    }
  };

  const voteCard = (column: "keep" | "stop" | "start", cardId: string) => {
    setRetro((prev) => ({
      ...prev,
      [column]: prev[column].map((card) =>
        card.id === cardId ? { ...card, votes: card.votes + 1 } : card,
      ),
    }));
  };

  const deleteCard = (column: "keep" | "stop" | "start", cardId: string) => {
    setRetro((prev) => ({
      ...prev,
      [column]: prev[column].filter((card) => card.id !== cardId),
    }));
  };

  const renderColumn = (
    title: string,
    column: "keep" | "stop" | "start",
    cards: RetroCard[],
    bgColor: string,
  ) => {
    return (
      <div className={`flex-1 ${bgColor} p-4 rounded-lg`}>
        <h3 className="font-bold text-lg mb-4">{title}</h3>
        <div className="space-y-2 mb-4">
          {cards
            .sort((a, b) => b.votes - a.votes)
            .map((card) => (
              <div
                key={card.id}
                className="bg-card p-3 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <p className="text-sm font-medium flex-1">{card.content}</p>
                  <button
                    onClick={() => deleteCard(column, card.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {card.anonymous ? "Anonymous" : "Team"}
                  </span>
                  <button
                    onClick={() => voteCard(column, card.id)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <ThumbsUp className="w-3 h-3" />
                    {card.votes}
                  </button>
                </div>
              </div>
            ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add a card..."
            value={newCards[column]}
            onChange={(e) =>
              setNewCards((prev) => ({ ...prev, [column]: e.target.value }))
            }
            onKeyPress={(e) => {
              if (e.key === "Enter") addCard(column, newCards[column]);
            }}
            className="flex-1 px-2 py-2 border rounded text-xs"
          />
          <Button
            size="sm"
            onClick={() => addCard(column, newCards[column])}
            className="gap-1"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-bold mb-4">Sprint Retrospective</h2>

      <div className="flex gap-4">
        {renderColumn("Keep", "keep", retro.keep, "bg-green-50")}
        {renderColumn("Stop", "stop", retro.stop, "bg-red-50")}
        {renderColumn("Start", "start", retro.start, "bg-blue-50")}
      </div>

      <div className="p-3 bg-muted rounded-lg text-sm border">
        <p className="font-medium">
          Total cards:{" "}
          {retro.keep.length + retro.stop.length + retro.start.length}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Anonymous voting enabled • Team members can vote on actions
        </p>
      </div>
    </div>
  );
}
