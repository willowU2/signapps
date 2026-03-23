"use client";

import { useState } from "react";
import { GripVertical, X, Plus } from "lucide-react";

interface TimeBlock {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  category: "focus" | "meeting" | "break" | "admin";
  isDragging?: boolean;
}

const COLORS = {
  focus: "bg-blue-100 border-blue-300",
  meeting: "bg-purple-100 border-purple-300",
  break: "bg-green-100 border-green-300",
  admin: "bg-gray-100 border-gray-300",
};

const DEFAULT_BLOCKS: TimeBlock[] = [
  {
    id: "1",
    startTime: "09:00",
    endTime: "11:00",
    title: "Deep Work Sprint",
    category: "focus",
  },
  {
    id: "2",
    startTime: "11:00",
    endTime: "11:30",
    title: "Team Standup",
    category: "meeting",
  },
  {
    id: "3",
    startTime: "12:00",
    endTime: "13:00",
    title: "Lunch Break",
    category: "break",
  },
  {
    id: "4",
    startTime: "14:00",
    endTime: "16:00",
    title: "Email & Admin",
    category: "admin",
  },
];

export function TimeBlocking() {
  const [blocks, setBlocks] = useState<TimeBlock[]>(DEFAULT_BLOCKS);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  const handleRemoveBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const handleAddBlock = () => {
    const newBlock: TimeBlock = {
      id: Date.now().toString(),
      startTime: "17:00",
      endTime: "17:30",
      title: "New Task",
      category: "focus",
    };
    setBlocks([...blocks, newBlock]);
  };

  const focusHours = blocks
    .filter((b) => b.category === "focus")
    .reduce((acc, b) => {
      const [startH, startM] = b.startTime.split(":").map(Number);
      const [endH, endM] = b.endTime.split(":").map(Number);
      const minutes = endH * 60 + endM - (startH * 60 + startM);
      return acc + minutes / 60;
    }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Time Blocking</h2>
          <p className="text-gray-600">
            Organize your day with focused time blocks
          </p>
        </div>
        <button
          onClick={handleAddBlock}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Block
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700 font-medium">Focus Time Today</p>
        <p className="text-2xl font-bold text-blue-900">{focusHours.toFixed(1)}h</p>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4">
          <h3 className="font-semibold text-gray-900">Today's Schedule</h3>
        </div>

        <div className="space-y-2 p-4">
          {blocks.map((block) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => handleDragStart(block.id)}
              onDragEnd={handleDragEnd}
              className={`p-3 rounded-lg border-2 cursor-move transition-opacity ${
                draggedId === block.id ? "opacity-50" : ""
              } ${COLORS[block.category]} flex items-start gap-3`}
            >
              <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{block.title}</p>
                  <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded">
                    {block.startTime} - {block.endTime}
                  </span>
                </div>
                <p className="text-xs text-gray-600 capitalize mt-1">
                  {block.category}
                </p>
              </div>
              <button
                onClick={() => handleRemoveBlock(block.id)}
                className="text-gray-400 hover:text-red-600 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {Object.entries(COLORS).map(([category, color]) => (
          <div key={category} className={`rounded-lg p-3 border ${color}`}>
            <p className="text-xs font-medium text-gray-700 capitalize">
              {category}
            </p>
            <p className="text-lg font-bold text-gray-900">
              {blocks.filter((b) => b.category === category).length}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
