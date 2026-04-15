"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Tag } from "lucide-react";

// ─── Tag Colors ──────────────────────────────────────────────────────
const TAG_COLORS = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// ─── Storage helpers ─────────────────────────────────────────────────
const STORAGE_KEY = "signapps-document-tags";

interface TagStore {
  [documentId: string]: string[];
}

function loadTags(): TagStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveTags(store: TagStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full or unavailable
  }
}

export function getDocumentTags(docId: string): string[] {
  return loadTags()[docId] ?? [];
}

export function setDocumentTags(docId: string, tags: string[]) {
  const store = loadTags();
  if (tags.length === 0) {
    delete store[docId];
  } else {
    store[docId] = tags;
  }
  saveTags(store);
}

export function getAllUsedTags(): string[] {
  const store = loadTags();
  const set = new Set<string>();
  Object.values(store).forEach((tags) => tags.forEach((t) => set.add(t)));
  return Array.from(set).sort();
}

// ─── DocumentTags component ─────────────────────────────────────────
interface DocumentTagsProps {
  documentId: string;
  compact?: boolean;
  onFilterByTag?: (tag: string) => void;
}

export function DocumentTags({
  documentId,
  compact = false,
  onFilterByTag,
}: DocumentTagsProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTags(getDocumentTags(documentId));
  }, [documentId]);

  const addTag = useCallback(() => {
    const tag = newTag.trim().toLowerCase();
    if (!tag || tags.includes(tag)) {
      setNewTag("");
      setIsAdding(false);
      return;
    }
    const updated = [...tags, tag];
    setTags(updated);
    setDocumentTags(documentId, updated);
    setNewTag("");
    setIsAdding(false);
  }, [newTag, tags, documentId]);

  const removeTag = useCallback(
    (tag: string) => {
      const updated = tags.filter((t) => t !== tag);
      setTags(updated);
      setDocumentTags(documentId, updated);
    },
    [tags, documentId],
  );

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  if (compact) {
    return (
      <div
        className="flex items-center gap-1 flex-wrap"
        onClick={(e) => e.stopPropagation()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 rounded-full border font-medium cursor-pointer ${getTagColor(tag)}`}
            onClick={(e) => {
              e.stopPropagation();
              onFilterByTag?.(tag);
            }}
          >
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-0.5 hover:opacity-70"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {isAdding ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            className="h-4 w-16 text-[10px] bg-transparent border-b border-primary/50 outline-none px-0.5"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onBlur={() => {
              if (newTag.trim()) addTag();
              else setIsAdding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag();
              if (e.key === "Escape") {
                setIsAdding(false);
                setNewTag("");
              }
            }}
            placeholder="tag..."
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted hover:bg-muted-foreground/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(true);
            }}
            title="Ajouter un tag"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={`gap-1 text-xs cursor-pointer ${getTagColor(tag)}`}
          onClick={(e) => {
            e.stopPropagation();
            onFilterByTag?.(tag);
          }}
        >
          {tag}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="hover:opacity-70"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {isAdding ? (
        <Input
          ref={inputRef}
          className="h-6 w-20 text-xs"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onBlur={() => {
            if (newTag.trim()) addTag();
            else setIsAdding(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTag();
            if (e.key === "Escape") {
              setIsAdding(false);
              setNewTag("");
            }
          }}
          placeholder="Nouveau tag..."
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

// ─── Tag Filter Bar ─────────────────────────────────────────────────
interface TagFilterBarProps {
  activeTag: string | null;
  onFilterChange: (tag: string | null) => void;
}

export function TagFilterBar({ activeTag, onFilterChange }: TagFilterBarProps) {
  const allTags = getAllUsedTags();

  if (allTags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tag className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground font-medium">
        Filtrer :
      </span>
      {activeTag && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onFilterChange(null)}
        >
          Tout afficher
        </Button>
      )}
      {allTags.map((tag) => (
        <Badge
          key={tag}
          variant={activeTag === tag ? "default" : "outline"}
          className={`text-xs cursor-pointer transition-all ${
            activeTag === tag
              ? "bg-primary text-primary-foreground"
              : getTagColor(tag) + " hover:opacity-80"
          }`}
          onClick={() => onFilterChange(activeTag === tag ? null : tag)}
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}
