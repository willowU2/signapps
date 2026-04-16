"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Upload,
  MessageSquare,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  notes?: string;
  photos?: string[];
}

interface FieldChecklistProps {
  checklistName: string;
  items?: ChecklistItem[];
  isOnline?: boolean;
  onItemToggle?: (itemId: string) => void;
  onNotesChange?: (itemId: string, notes: string) => void;
  onPhotoAdd?: (itemId: string, photoUrl: string) => void;
  onSubmit?: (items: ChecklistItem[]) => void;
}

export function FieldChecklist({
  checklistName,
  items = [],
  isOnline = true,
  onItemToggle,
  onNotesChange,
  onPhotoAdd,
  onSubmit,
}: FieldChecklistProps) {
  const [localItems, setLocalItems] = useState(items);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [photoInputs, setPhotoInputs] = useState<Record<string, File | null>>(
    {},
  );

  const handleToggleItem = (itemId: string) => {
    const updated = localItems.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );
    setLocalItems(updated);
    onItemToggle?.(itemId);
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    const updated = localItems.map((item) =>
      item.id === itemId ? { ...item, notes } : item,
    );
    setLocalItems(updated);
    onNotesChange?.(itemId, notes);
  };

  const handlePhotoUpload = (itemId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const photoUrl = e.target?.result as string;
      const updated = localItems.map((item) =>
        item.id === itemId
          ? { ...item, photos: [...(item.photos || []), photoUrl] }
          : item,
      );
      setLocalItems(updated);
      onPhotoAdd?.(itemId, photoUrl);
    };
    reader.readAsDataURL(file);
  };

  const completionRate = Math.round(
    (localItems.filter((i) => i.completed).length / localItems.length) * 100,
  );

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{checklistName}</h1>
            <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
              {completionRate}% Complete (
              {localItems.filter((i) => i.completed).length}/{localItems.length}
              )
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Wifi className="size-4" />
                <span className="text-xs font-medium">Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <WifiOff className="size-4" />
                <span className="text-xs font-medium">Offline</span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </Card>

      {/* Checklist Items */}
      <div className="space-y-2">
        {localItems.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={() => handleToggleItem(item.id)}
                className="mt-1 flex-shrink-0 focus:outline-none"
              >
                {item.completed ? (
                  <CheckCircle2 className="size-6 text-green-500" />
                ) : (
                  <Circle className="size-6 text-gray-400" />
                )}
              </button>

              {/* Item Label and Expandable Content */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() =>
                    setExpandedItem(expandedItem === item.id ? null : item.id)
                  }
                  className="w-full text-left"
                >
                  <p
                    className={`font-medium ${item.completed ? "line-through text-muted-foreground" : ""}`}
                  >
                    {item.label}
                  </p>
                </button>

                {/* Expanded Content */}
                {expandedItem === item.id && (
                  <div className="mt-4 space-y-3 border-t pt-3">
                    {/* Notes Section */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="size-4 text-muted-foreground" />
                        <label className="text-sm font-medium">Notes</label>
                      </div>
                      <textarea
                        value={item.notes || ""}
                        onChange={(e) =>
                          handleNotesChange(item.id, e.target.value)
                        }
                        placeholder="Add notes for this item..."
                        className="w-full px-3 py-2 border rounded text-sm bg-card dark:bg-gray-900 dark:border-gray-700"
                        rows={2}
                      />
                    </div>

                    {/* Photos Section */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Upload className="size-4 text-muted-foreground" />
                        <label className="text-sm font-medium">Photos</label>
                      </div>
                      {item.photos && item.photos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {item.photos.map((photo, idx) => (
                            <div
                              key={idx}
                              className="aspect-square rounded border overflow-hidden"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo}
                                alt={`Checklist attachment ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handlePhotoUpload(item.id, e.target.files[0]);
                          }
                        }}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Submit Button */}
      <Card className="p-4 sticky bottom-6">
        <Button
          onClick={() => onSubmit?.(localItems)}
          className="w-full"
          disabled={!isOnline}
        >
          {isOnline ? "Submit Checklist" : "Offline - Save Locally"}
        </Button>
      </Card>
    </div>
  );
}
