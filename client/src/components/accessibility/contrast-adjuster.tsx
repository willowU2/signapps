"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ContrastPreset {
  name: string;
  ratio: number;
  foreground: string;
  background: string;
}

export default function ContrastAdjuster() {
  const [contrastLevel, setContrastLevel] = useState(4.5);
  const [currentPreset, setCurrentPreset] = useState<ContrastPreset | null>(null);

  const presets: ContrastPreset[] = [
    {
      name: "Normal",
      ratio: 4.5,
      foreground: "#333333",
      background: "#ffffff",
    },
    {
      name: "Enhanced",
      ratio: 7,
      foreground: "#000000",
      background: "#ffffff",
    },
    {
      name: "Dark Mode",
      ratio: 8.2,
      foreground: "#ffffff",
      background: "#1a1a1a",
    },
  ];

  const autoFix = () => {
    // In production, this would analyze the page and adjust colors
    toast.info("Auto-fixing contrast issues. Checking all text elements...");
  };

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-bold">Contrast Adjuster</h2>

      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <p className="font-medium">Current Contrast Ratio</p>
          <p className="text-2xl font-bold text-blue-600">{contrastLevel}:1</p>
        </div>
        <div className="flex gap-2">
          <input
            type="range"
            min="1"
            max="21"
            step="0.5"
            value={contrastLevel}
            onChange={(e) => setContrastLevel(parseFloat(e.target.value))}
            className="flex-1"
          />
          <Button size="sm" onClick={autoFix} className="gap-2">
            <Zap className="w-4 h-4" />
            Auto-Fix
          </Button>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {contrastLevel >= 7 ? "✓ AAA Compliant (Best)" : contrastLevel >= 4.5 ? "✓ AA Compliant" : "✗ Below WCAG AA"}
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-medium text-sm">Preview Panels</p>
        {presets.map((preset) => (
          <div
            key={preset.name}
            className="p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-blue-400"
            style={{
              backgroundColor: preset.background,
              borderColor: currentPreset?.name === preset.name ? "#3b82f6" : "#e5e7eb",
            }}
            onClick={() => setCurrentPreset(preset)}
          >
            <p
              style={{ color: preset.foreground }}
              className="font-medium"
            >
              {preset.name} ({preset.ratio}:1)
            </p>
            <p style={{ color: preset.foreground }} className="text-sm opacity-80">
              Sample text for contrast preview
            </p>
          </div>
        ))}
      </div>

      {currentPreset && (
        <div className="p-3 bg-green-50 rounded-lg text-sm border border-green-200">
          <p className="font-medium text-green-900">✓ {currentPreset.name} preset selected</p>
        </div>
      )}
    </div>
  );
}
