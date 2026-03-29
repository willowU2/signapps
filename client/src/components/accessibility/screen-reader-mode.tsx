"use client";

import { useEffect, useState } from "react";
import { Volume2, Eye, Type, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ScreenReaderMode() {
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [ariaLabelsVisible, setAriaLabelsVisible] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  const toggleHighContrast = () => {
    setHighContrast(!highContrast);
    if (!highContrast) {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }
  };

  const toggleLargeText = () => {
    setLargeText(!largeText);
    if (!largeText) {
      document.documentElement.style.fontSize = "18px";
    } else {
      document.documentElement.style.fontSize = "16px";
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-bold">Screen Reader Mode</h2>

      <div className="grid gap-3">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            <div>
              <p className="font-medium">Screen Reader Active</p>
              <p className="text-xs text-muted-foreground">Content will be announced</p>
            </div>
          </div>
          <div className={`w-12 h-6 rounded-full ${screenReaderEnabled ? "bg-green-500" : "bg-gray-300"}`} />
        </div>

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            <div>
              <p className="font-medium">High Contrast Mode</p>
              <p className="text-xs text-muted-foreground">Enhanced text visibility</p>
            </div>
          </div>
          <Button
            size="sm"
            variant={highContrast ? "default" : "outline"}
            onClick={toggleHighContrast}
          >
            {highContrast ? "On" : "Off"}
          </Button>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
          <div className="flex items-center gap-2">
            <Type className="w-5 h-5" />
            <div>
              <p className="font-medium">Large Text</p>
              <p className="text-xs text-muted-foreground">Increase font size by 25%</p>
            </div>
          </div>
          <Button size="sm" variant={largeText ? "default" : "outline"} onClick={toggleLargeText}>
            {largeText ? "On" : "Off"}
          </Button>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            <div>
              <p className="font-medium">ARIA Labels Indicator</p>
              <p className="text-xs text-muted-foreground">{ariaLabelsVisible ? "Showing" : "Hidden"} accessible labels</p>
            </div>
          </div>
          <Button
            size="sm"
            variant={ariaLabelsVisible ? "default" : "outline"}
            onClick={() => setAriaLabelsVisible(!ariaLabelsVisible)}
          >
            {ariaLabelsVisible ? "Show" : "Hide"}
          </Button>
        </div>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg text-sm">
        <p className="font-medium">Tip: Press <kbd className="px-2 py-1 bg-card rounded border">Alt</kbd> + <kbd className="px-2 py-1 bg-card rounded border">A</kbd> to toggle accessibility features</p>
      </div>
    </div>
  );
}
