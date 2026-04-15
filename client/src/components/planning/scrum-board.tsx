"use client";

import { useState } from "react";
import { GripHorizontal, Trash2 } from "lucide-react";

interface Story {
  id: string;
  title: string;
  points: number;
  assignee?: string;
  priority: "low" | "medium" | "high";
}

interface Column {
  name: string;
  stories: Story[];
}

export default function ScrumBoard() {
  const [board, setBoard] = useState<Record<string, Story[]>>({
    Backlog: [
      {
        id: "1",
        title: "User authentication",
        points: 8,
        priority: "high",
        assignee: "Alice",
      },
      {
        id: "2",
        title: "Forgot password flow",
        points: 5,
        priority: "medium",
        assignee: "Bob",
      },
      { id: "3", title: "Email verification", points: 3, priority: "low" },
    ],
    Sprint: [
      {
        id: "4",
        title: "Dashboard layout",
        points: 5,
        priority: "high",
        assignee: "Carol",
      },
      {
        id: "5",
        title: "API integration",
        points: 8,
        priority: "high",
        assignee: "David",
      },
    ],
    InProgress: [
      {
        id: "6",
        title: "Database schema",
        points: 13,
        priority: "high",
        assignee: "Eve",
      },
    ],
    Done: [
      { id: "7", title: "Project setup", points: 2, priority: "medium" },
      { id: "8", title: "Dev environment", points: 3, priority: "high" },
    ],
  });

  const columns = ["Backlog", "Sprint", "InProgress", "Done"];
  const displayNames: Record<string, string> = {
    Backlog: "Backlog",
    Sprint: "Sprint",
    InProgress: "En cours",
    Done: "Terminé",
  };

  const moveStory = (fromColumn: string, storyId: string, toColumn: string) => {
    const story = board[fromColumn].find((s) => s.id === storyId);
    if (story) {
      setBoard((prev) => ({
        ...prev,
        [fromColumn]: prev[fromColumn].filter((s) => s.id !== storyId),
        [toColumn]: [...prev[toColumn], story],
      }));
    }
  };

  const deleteStory = (column: string, storyId: string) => {
    setBoard((prev) => ({
      ...prev,
      [column]: prev[column].filter((s) => s.id !== storyId),
    }));
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      high: "bg-red-100 text-red-800 border-red-300",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
      low: "bg-green-100 text-green-800 border-green-300",
    };
    return colors[priority as keyof typeof colors];
  };

  const totalPoints = Object.values(board)
    .flat()
    .reduce((sum, s) => sum + s.points, 0);
  const sprintPoints = board.Sprint.reduce((sum, s) => sum + s.points, 0);

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Scrum Board</h2>
        <div className="flex gap-4 text-sm">
          <div className="p-2 bg-blue-50 rounded">
            <p className="text-xs text-muted-foreground">Sprint Points</p>
            <p className="font-bold text-blue-600">{sprintPoints}</p>
          </div>
          <div className="p-2 bg-muted rounded">
            <p className="text-xs text-muted-foreground">Total Points</p>
            <p className="font-bold text-muted-foreground">{totalPoints}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 overflow-x-auto">
        {columns.map((column) => (
          <div key={column} className="bg-muted rounded-lg p-3 min-w-80">
            <h3 className="font-bold text-sm mb-3 p-2 bg-card rounded text-center">
              {displayNames[column]}
            </h3>
            <div className="space-y-2">
              {board[column].map((story) => (
                <div
                  key={story.id}
                  className="bg-card p-3 rounded-lg shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer?.setData("storyId", story.id);
                    e.dataTransfer?.setData("fromColumn", column);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const storyId = e.dataTransfer?.getData("storyId");
                    const fromColumn = e.dataTransfer?.getData("fromColumn");
                    if (storyId && fromColumn) {
                      moveStory(fromColumn, storyId, column);
                    }
                  }}
                >
                  <div className="flex gap-2 items-start mb-2">
                    <GripHorizontal className="w-3 h-3 text-gray-400 mt-1 flex-shrink-0" />
                    <p className="text-sm font-medium flex-1">{story.title}</p>
                    <button
                      onClick={() => deleteStory(column, story.id)}
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded border ${getPriorityColor(story.priority)}`}
                    >
                      {story.priority.charAt(0).toUpperCase() +
                        story.priority.slice(1)}
                    </span>
                    <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {story.points}pt
                    </span>
                  </div>

                  {story.assignee && (
                    <p className="text-xs text-muted-foreground mt-2">
                      👤 {story.assignee}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-blue-50 rounded-lg text-sm border border-blue-200">
        <p className="font-medium text-blue-900">
          Drag and drop stories between columns • Click delete to remove
        </p>
      </div>
    </div>
  );
}
