"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "signapps-reduce-motion";

export function ReduceMotionToggle() {
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
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.classList.remove("reduce-motion");
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
          <RefreshCcw className="h-4 w-4 text-muted-foreground" />
          <Label
            htmlFor="reduce-motion-toggle"
            className="font-medium cursor-pointer"
          >
            Réduction des Mouvements
          </Label>
        </div>
        <p className="text-xs text-muted-foreground ml-6">
          Désactive toutes les animations et transitions (confort visuel /
          vestibulaire).
        </p>
      </div>
      <Switch
        id="reduce-motion-toggle"
        checked={enabled}
        onCheckedChange={toggle}
        aria-label="Toggle reduce motion"
      />
    </div>
  );
}
