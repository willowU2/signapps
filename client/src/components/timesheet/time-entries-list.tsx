"use client";

import { useState } from "react";
import { Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface TimeEntry {
  id: string;
  date: string;
  project: string;
  task: string;
  duration: number; // in seconds
}

interface TimeEntriesListProps {
  entries: TimeEntry[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updated: Partial<TimeEntry>) => void;
}

export function TimeEntriesList({
  entries,
  onDelete,
  onUpdate,
}: TimeEntriesListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TimeEntry>>({});

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditingId(entry.id);
    setEditForm({ ...entry });
  };

  const handleSave = () => {
    if (editingId && editForm.duration !== undefined) {
      onUpdate(editingId, {
        duration: editForm.duration,
        project: editForm.project,
        task: editForm.task,
      });
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      onDelete(id);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Time Entries</h2>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center h-24 text-muted-foreground"
                >
                  No time entries yet. Start tracking to see entries here.
                </TableCell>
              </TableRow>
            ) : null}

            {entries.map((entry) =>
              editingId === entry.id ? (
                <TableRow key={entry.id} className="bg-muted/30">
                  <TableCell className="text-sm">
                    {formatDate(entry.date)}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editForm.project || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, project: e.target.value })
                      }
                      className="h-8 text-sm"
                      placeholder="Project"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={editForm.task || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, task: e.target.value })
                      }
                      className="h-8 text-sm"
                      placeholder="Task"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={editForm.duration || 0}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          duration: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="h-8 text-sm font-mono"
                      placeholder="Seconds"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600"
                        onClick={handleSave}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={handleCancel}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">
                    {formatDate(entry.date)}
                  </TableCell>
                  <TableCell className="text-sm">{entry.project}</TableCell>
                  <TableCell className="text-sm">{entry.task}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatTime(entry.duration)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEdit(entry)}
                        disabled={editingId !== null}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                        disabled={editingId !== null}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
