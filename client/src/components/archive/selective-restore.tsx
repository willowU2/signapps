"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Folder, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArchivedItem {
  id: string;
  name: string;
  size: number;
  archivedDate: Date;
  selected?: boolean;
}

export function SelectiveRestore() {
  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [selectedCount, setSelectedCount] = useState(0);
  const [destination, setDestination] = useState("original");

  useEffect(() => {
    setItems([
      { id: "1", name: "Contracts_2022.pdf", size: 12.5, archivedDate: new Date(Date.now() - 180 * 24 * 3600000), selected: false },
      { id: "2", name: "Budget_Plan_Q1.xlsx", size: 2.8, archivedDate: new Date(Date.now() - 120 * 24 * 3600000), selected: false },
      { id: "3", name: "ProjectData_Archive.zip", size: 45.3, archivedDate: new Date(Date.now() - 90 * 24 * 3600000), selected: false },
      { id: "4", name: "OldDocuments_Backup.tar", size: 78.2, archivedDate: new Date(Date.now() - 60 * 24 * 3600000), selected: false },
    ]);
  }, []);

  const toggleItem = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, selected: !item.selected } : item
    );
    setItems(updated);
    setSelectedCount(updated.filter((i) => i.selected).length);
  };

  const toggleAll = () => {
    const allSelected = items.every((i) => i.selected);
    const updated = items.map((item) => ({ ...item, selected: !allSelected }));
    setItems(updated);
    setSelectedCount(updated.filter((i) => i.selected).length);
  };

  const formatSize = (mb: number) => {
    if (mb > 1024) return (mb / 1024).toFixed(1) + " GB";
    return mb.toFixed(1) + " MB";
  };

  const totalSize = items
    .filter((i) => i.selected)
    .reduce((sum, item) => sum + item.size, 0);

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Restore Archived Items</h3>
          {selectedCount > 0 && (
            <span className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium">
              {selectedCount} selected
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Select items to restore. Total size: {formatSize(totalSize)}
        </p>
      </div>

      <div className="space-y-2">
        <div className="border rounded-lg p-4 bg-muted flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="gap-2"
          >
            {items.every((i) => i.selected) ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
            <span className="font-medium">Select All</span>
          </Button>
        </div>

        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 flex items-center space-x-3">
            <button
              onClick={() => toggleItem(item.id)}
              className="flex-shrink-0"
            >
              {item.selected ? (
                <CheckSquare className="w-5 h-5 text-blue-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <Folder className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatSize(item.size)} • Archived: {item.archivedDate.toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border rounded-lg p-4">
        <label className="block font-semibold mb-3">Restore Destination</label>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input type="radio" name="destination" value="original" checked={destination === "original"} onChange={(e) => setDestination(e.target.value)} />
            <span>Original Location</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="radio" name="destination" value="select" checked={destination === "select"} onChange={(e) => setDestination(e.target.value)} />
            <span>Choose Location</span>
          </label>
        </div>
        {destination === "select" && (
          <input type="text" placeholder="Enter destination path" className="w-full border rounded px-3 py-2 mt-2" />
        )}
      </div>

      <div className="flex gap-2">
        <Button disabled={selectedCount === 0} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Restore {selectedCount > 0 ? `(${selectedCount})` : ""}
        </Button>
        <Button variant="outline">Annuler</Button>
      </div>
    </div>
  );
}
