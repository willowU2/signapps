"use client";

// IDEA-122: Quick Notes widget for the extended widget library

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StickyNote, Save, RotateCcw } from "lucide-react";
import type { WidgetRenderProps } from "@/lib/dashboard/types";
import { toast } from "sonner";

const STORAGE_KEY = "dashboard_quick_notes";

export function WidgetQuickNotes({ widget }: WidgetRenderProps) {
  const widgetId = widget.id;
  const storageKey = `${STORAGE_KEY}_${widgetId}`;

  const [content, setContent] = useState("");
  const [saved, setSaved] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) ?? "";
      setContent(stored);
      setSaved(stored);
    } catch {
      // Silently fail
    }
  }, [storageKey]);

  const handleChange = (v: string) => {
    setContent(v);
    setDirty(v !== saved);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(storageKey, content);
      setSaved(content);
      setDirty(false);
      toast.success("Note sauvegardée");
    } catch {
      toast.error("Impossible de sauvegarder");
    }
  };

  const handleReset = () => {
    setContent(saved);
    setDirty(false);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-yellow-500" />
            Notes rapides
          </span>
          <div className="flex items-center gap-1">
            {dirty && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleReset}
                title="Annuler les modifications"
                aria-label="Annuler les modifications"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="icon"
              variant={dirty ? "default" : "ghost"}
              className="h-6 w-6"
              onClick={handleSave}
              disabled={!dirty}
              title="Sauvegarder"
              aria-label="Sauvegarder"
            >
              <Save className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-3 pt-0">
        <textarea
          className="w-full h-full min-h-[120px] resize-none text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground leading-relaxed"
          placeholder="Écrivez vos notes ici…&#10;Ctrl+S pour sauvegarder"
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
              e.preventDefault();
              handleSave();
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
