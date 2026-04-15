"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tag, X, Filter } from "lucide-react";
import { toast } from "sonner";

interface CollabTaggingProps {
  documentName?: string;
  onTagsChange?: (tags: string[]) => void;
}

const POPULAR_TAGS = [
  { name: "urgent", count: 12 },
  { name: "review", count: 8 },
  { name: "final", count: 7 },
  { name: "draft", count: 6 },
  { name: "important", count: 5 },
  { name: "legal", count: 4 },
  { name: "marketing", count: 3 },
  { name: "finance", count: 3 },
];

export function CollabTagging({
  documentName = "document.pdf",
  onTagsChange,
}: CollabTaggingProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().trim();
    if (!normalized) return;
    if (tags.includes(normalized)) {
      toast.info("Tag already added");
      return;
    }
    if (tags.length >= 10) {
      toast.error("Maximum 10 tags allowed");
      return;
    }
    const newTags = [...tags, normalized];
    setTags(newTags);
    setInputValue("");
    onTagsChange?.(newTags);
    toast.success("Tag added");
  };

  const removeTag = (tag: string) => {
    const newTags = tags.filter((t) => t !== tag);
    setTags(newTags);
    onTagsChange?.(newTags);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  const filteredTags = selectedFilter
    ? tags.filter((t) => t.includes(selectedFilter))
    : tags;

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Collaborative Tagging: {documentName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Document Preview */}
          <div className="p-3 bg-muted rounded-lg border">
            <p className="text-sm text-muted-foreground font-medium mb-1">
              Document
            </p>
            <p className="text-sm text-muted-foreground">{documentName}</p>
          </div>

          {/* Tag Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Add Tags</label>
            <div className="flex gap-2">
              <Input
                placeholder="Type tag name and press Enter"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button onClick={() => addTag(inputValue)} variant="outline">
                Add
              </Button>
            </div>
          </div>

          {/* Current Tags Cloud */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Applied Tags ({tags.length}/10)
            </label>
            <div className="flex flex-wrap gap-2 min-h-8 p-2 bg-muted rounded-lg border">
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tags yet</p>
              ) : (
                tags.map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Filter by Tag */}
          {tags.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter Tags
              </label>
              <div className="flex gap-1 flex-wrap">
                <Button
                  variant={selectedFilter === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFilter(null)}
                  className="text-xs"
                >
                  All
                </Button>
                {tags.map((tag) => (
                  <Button
                    key={tag}
                    variant={selectedFilter === tag ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFilter(tag)}
                    className="text-xs"
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Popular Tags Sidebar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Popular Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {POPULAR_TAGS.map((tag) => (
              <button
                key={tag.name}
                onClick={() => addTag(tag.name)}
                disabled={tags.includes(tag.name)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left text-sm"
              >
                <span className="font-medium">{tag.name}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  {tag.count}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
