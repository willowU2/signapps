"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { storageApi } from "@/lib/api";
import { Tag, Loader2, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface ManageTagsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagsUpdated?: () => void;
}

const PREDEFINED_COLORS = [
  "bg-slate-500",
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-green-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-rose-500",
];

export function ManageTagsSheet({
  open,
  onOpenChange,
  onTagsUpdated,
}: ManageTagsSheetProps) {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(false);

  // Create mode
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PREDEFINED_COLORS[0]);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    if (open) {
      loadTags();
      setIsCreating(false);
      setEditingId(null);
    }
  }, [open]);

  const loadTags = async () => {
    try {
      setLoading(true);
      // In a real implementation this would fetch from /api/v1/tags
      const response = await storageApi.getTags();
      setTags(response.data);
    } catch (error) {
      toast.error("Failed to load tags");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newName.trim()) return;

    try {
      await storageApi.createTag({
        name: newName,
        color: newColor,
      });
      toast.success("Tag created successfully");
      setNewName("");
      setIsCreating(false);
      loadTags();
      onTagsUpdated?.();
    } catch (error) {
      toast.error("Failed to create tag");
    }
  };

  const handleUpdateTag = async () => {
    if (!editingId || !editName.trim()) return;

    try {
      await storageApi.updateTag(editingId, {
        name: editName,
        color: editColor,
      });
      toast.success("Tag updated successfully");
      setEditingId(null);
      loadTags();
      onTagsUpdated?.();
    } catch (error) {
      toast.error("Failed to update tag");
    }
  };

  const handleDeleteTag = async (id: string) => {
    try {
      await storageApi.deleteTag(id);
      toast.success("Tag deleted successfully");
      loadTags();
      onTagsUpdated?.();
    } catch (error) {
      toast.error("Failed to delete tag");
    }
  };

  const startEditing = (tag: TagData) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setIsCreating(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            Manage Global Tags
          </SheetTitle>
          <SheetDescription>
            Create and manage tags to organize your files. These tags can be
            applied to any of your files.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col mt-6 min-h-0 relative">
          {/* Create new tag button/form */}
          <div className="mb-4">
            {!isCreating && !editingId && (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setIsCreating(true)}
              >
                + Create New Tag
              </Button>
            )}

            {isCreating && (
              <div className="bg-muted/50 p-4 rounded-lg border space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Tag Name</Label>
                  <Input
                    className="h-9"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Finance, Urgent, Draft..."
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Color</Label>
                  <div className="flex flex-wrap gap-2 pt-1 border rounded-md p-2 bg-background">
                    {PREDEFINED_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-6 h-6 rounded-full transition-all hover:scale-110 ${c} ${
                          newColor === c
                            ? "ring-2 ring-offset-2 ring-foreground scale-110"
                            : ""
                        }`}
                        onClick={() => setNewColor(c)}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreateTag} disabled={!newName.trim()}>
                    Create
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Tags list */}
          <div className="flex-1 border rounded-md overflow-hidden bg-muted/10">
            {loading ? (
              <div className="h-full flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tags.length === 0 && !isCreating ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <Tag className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No tags found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a new tag to get started
                </p>
              </div>
            ) : (
               <ScrollArea className="h-full p-3">
                 <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="border rounded-lg p-3 flex items-center justify-between bg-card shrink-0"
                    >
                      {editingId === tag.id ? (
                        <div className="flex-1 space-y-3">
                          <Input
                            className="h-9"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                          />
                          <div className="flex flex-wrap gap-2 p-2 border rounded bg-muted/30">
                            {PREDEFINED_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                className={`w-6 h-6 rounded-full transition-all hover:scale-110 ${c} ${
                                  editColor === c
                                    ? "ring-2 ring-offset-2 ring-foreground scale-110"
                                    : ""
                                }`}
                                onClick={() => setEditColor(c)}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleUpdateTag}>
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Badge
                            className={`${tag.color} text-white hover:${tag.color}/90 px-3 py-1 font-medium`}
                          >
                            {tag.name}
                          </Badge>
                          <div className="flex gap-1.5 ml-3 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              onClick={() => startEditing(tag)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteTag(tag.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                 </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-6 mt-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
