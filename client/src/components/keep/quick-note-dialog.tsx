"use client";

import { useState, useRef, useEffect } from "react";
import { StickyNote, X, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKeepStore, NOTE_COLORS } from "@/stores/keep-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuickNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickNoteDialog({ open, onOpenChange }: QuickNoteDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState("#202124");
  const [showColors, setShowColors] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { addNote } = useKeepStore();

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      setTitle("");
      setContent("");
      setSelectedColor("#202124");
      setShowColors(false);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onOpenChange]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };
    // Small delay to avoid immediate close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = () => {
    if (title.trim() || content.trim()) {
      addNote({
        title: title.trim(),
        content: content.trim(),
        color: selectedColor,
      });
      toast.success("Note enregistr\ée dans Keep");
    }
    setTitle("");
    setContent("");
    setSelectedColor("#202124");
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]" />

      {/* Sticky note dialog - positioned like a floating sticky note */}
      <div
        ref={dialogRef}
        className="fixed z-50 bottom-24 right-6 w-[320px] rounded-lg shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
        style={{
          backgroundColor:
            selectedColor === "#202124" ? "hsl(var(--card))" : selectedColor,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Note rapide
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-3 pb-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            className="border-0 bg-transparent px-0 text-sm font-semibold placeholder:text-muted-foreground/50 focus-visible:ring-0 shadow-none h-8"
            onKeyDown={handleKeyDown}
          />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Prendre une note..."
            className="w-full bg-transparent border-0 resize-none text-sm placeholder:text-muted-foreground/50 focus:outline-none min-h-[100px] max-h-[200px]"
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowColors(!showColors)}
              >
                <Palette className="h-3.5 w-3.5" />
              </Button>
              {showColors && (
                <div className="absolute bottom-full left-0 mb-1 p-2 rounded-lg bg-card border shadow-lg flex flex-wrap gap-1 w-[180px]">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedColor(c.value);
                        setShowColors(false);
                      }}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-all hover:scale-110",
                        selectedColor === c.value
                          ? "border-white scale-110"
                          : "border-transparent",
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              Ctrl+Enter pour sauvegarder
            </span>
            <Button size="sm" className="h-7 text-xs px-3" onClick={handleSave}>
              Enregistrer
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
