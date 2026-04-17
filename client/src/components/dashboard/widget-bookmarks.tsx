"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bookmark, Plus, ExternalLink, Trash2, X } from "lucide-react";
import { useDashboardStore, BookmarkItem } from "@/stores/dashboard-store";

export function WidgetBookmarks() {
  const { bookmarks, addBookmark, removeBookmark, editMode } =
    useDashboardStore();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const handleAdd = () => {
    if (!label.trim() || !url.trim()) return;
    addBookmark({ label: label.trim(), url: url.trim() });
    setLabel("");
    setUrl("");
    setAdding(false);
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-5 w-5" />
          Bookmarks
        </CardTitle>
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {adding && (
          <div className="space-y-2 rounded-lg border p-3">
            <Input
              placeholder="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!label.trim() || !url.trim()}
              >
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAdding(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {bookmarks.length === 0 && !adding && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No bookmarks yet. Click + to add one.
          </p>
        )}

        {bookmarks.map((bm: BookmarkItem) => (
          <a
            key={bm.id}
            href={bm.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10">
              <Bookmark className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{bm.label}</p>
              <p className="truncate text-xs text-muted-foreground">{bm.url}</p>
            </div>
            {editMode ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeBookmark(bm.id);
                }}
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            ) : (
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
