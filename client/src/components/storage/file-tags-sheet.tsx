"use client";

import { SpinnerInfinity } from 'spinners-react';

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { storageApi } from "@/lib/api";
import { Tag, Check } from 'lucide-react';
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface FileTagsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileName: string;
  onTagsUpdated?: () => void;
}

export function FileTagsSheet({
  open,
  onOpenChange,
  fileId,
  fileName,
  onTagsUpdated,
}: FileTagsSheetProps) {
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [fileTagIds, setFileTagIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && fileId) {
      loadData();
    }
  }, [open, fileId]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch all available tags
      const tagsRes = await storageApi.getTags();
      setAllTags(tagsRes.data);

      // Fetch tags associated with this specific file
      const fileTagsRes = await storageApi.getFileTags(fileId);
      const associatedIds = fileTagsRes.data.map((t: TagData) => t.id);
      setFileTagIds(new Set(associatedIds));
    } catch {
      toast.error("Impossible de charger les tags");
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = async (tagId: string) => {
    const isAssociated = fileTagIds.has(tagId);
    setSavingId(tagId);

    try {
      if (isAssociated) {
        await storageApi.removeFileTag(fileId, tagId);
        const next = new Set(fileTagIds);
        next.delete(tagId);
        setFileTagIds(next);
      } else {
        await storageApi.addFileTag(fileId, tagId);
        const next = new Set(fileTagIds);
        next.add(tagId);
        setFileTagIds(next);
      }
      onTagsUpdated?.();
    } catch (error) {
      toast.error("Impossible de mettre à jour file tags");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            File Tags
          </SheetTitle>
          <div className="text-sm text-muted-foreground mt-2 bg-muted/30 p-3 rounded-md border break-all flex flex-col gap-1">
            <span className="font-medium">File:</span>
            <span className="text-foreground">{fileName}</span>
          </div>
        </SheetHeader>

        <div className="flex-1 mt-6 min-h-0 border text-sm rounded-md bg-muted/10 overflow-hidden relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-6 w-6  text-muted-foreground" />
            </div>
          ) : allTags.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Tag className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p>No tags available.</p>
              <p className="mt-1 text-xs">
                Go to "Manage Tags" to create some first.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full p-4">
              <div className="flex gap-2.5 flex-wrap">
                {allTags.map((tag) => {
                  const isSelected = fileTagIds.has(tag.id);
                  return (
                    <Button
                      key={tag.id}
                      variant="outline"
                      size="sm"
                      className={`h-9 gap-1.5 rounded-full border-2 transition-all ${
                        isSelected
                          ? `${tag.color} text-white border-transparent hover:${tag.color}/90`
                          : "border-muted/50 hover:border-primary/50 text-foreground"
                      }`}
                      onClick={() => toggleTag(tag.id)}
                      disabled={savingId === tag.id}
                    >
                      {savingId === tag.id ? (
                        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3.5 w-3.5 " />
                      ) : isSelected && (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {tag.name}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end pt-6 mt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
