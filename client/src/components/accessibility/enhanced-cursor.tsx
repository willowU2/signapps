"use client";

import { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "signapps-enhanced-cursor";

export function EnhancedCursorToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) === "true";
    setEnabled(stored);
    applySetting(stored);
  }, []);

  const applySetting = (on: boolean) => {
    if (on) {
      document.body.classList.add("enhanced-cursor");
    } else {
      document.body.classList.remove("enhanced-cursor");
    }
  };

  const toggle = (val: boolean) => {
    setEnabled(val);
    localStorage.setItem(STORAGE_KEY, String(val));
    applySetting(val);
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <MousePointer2 className="h-4 w-4 text-muted-foreground" />
          <Label
            htmlFor="enhanced-cursor-toggle"
            className="font-medium cursor-pointer"
          >
            Curseur Haute Visibilité
          </Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Remplace le petit curseur blanc natif par un grand curseur jaune fluo
          facilement repérable.
        </p>
      </div>
      <Switch
        id="enhanced-cursor-toggle"
        checked={enabled}
        onCheckedChange={toggle}
        aria-label="Toggle enhanced cursor"
      />
    </div>
  );
}
