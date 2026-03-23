"use client";

import { useEffect, useState } from "react";
import { Keyboard, Eye, List } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Shortcut {
  key: string;
  description: string;
  category: string;
}

export default function KeyboardNav() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [focusIndicatorVisible, setFocusIndicatorVisible] = useState(true);
  const [tabOrderVisible, setTabOrderVisible] = useState(false);

  const shortcuts: Shortcut[] = [
    { key: "Tab", description: "Navigate forward", category: "Navigation" },
    { key: "Shift + Tab", description: "Navigate backward", category: "Navigation" },
    { key: "Enter", description: "Activate button/link", category: "Interaction" },
    { key: "Space", description: "Toggle checkbox/radio", category: "Interaction" },
    { key: "Escape", description: "Close dialog/menu", category: "Interaction" },
    { key: "Arrow Keys", description: "Navigate within components", category: "Navigation" },
    { key: "Alt + A", description: "Toggle accessibility options", category: "Accessibility" },
    { key: "Alt + S", description: "Skip to main content", category: "Navigation" },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "a") {
        setShowShortcuts(!showShortcuts);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showShortcuts]);

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-2xl font-bold">Keyboard Navigation</h2>

      <div className="grid grid-cols-2 gap-3">
        <button
          className={`p-3 rounded-lg border-2 transition-all ${
            focusIndicatorVisible
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 bg-gray-50"
          }`}
          onClick={() => setFocusIndicatorVisible(!focusIndicatorVisible)}
        >
          <Eye className="w-5 h-5 mb-1" />
          <p className="text-sm font-medium">Focus Indicator</p>
          <p className="text-xs text-gray-600">{focusIndicatorVisible ? "Visible" : "Hidden"}</p>
        </button>

        <button
          className={`p-3 rounded-lg border-2 transition-all ${
            tabOrderVisible
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 bg-gray-50"
          }`}
          onClick={() => setTabOrderVisible(!tabOrderVisible)}
        >
          <List className="w-5 h-5 mb-1" />
          <p className="text-sm font-medium">Tab Order</p>
          <p className="text-xs text-gray-600">{tabOrderVisible ? "Visible" : "Hidden"}</p>
        </button>
      </div>

      <Button
        onClick={() => setShowShortcuts(!showShortcuts)}
        className="w-full gap-2"
        variant={showShortcuts ? "default" : "outline"}
      >
        <Keyboard className="w-4 h-4" />
        {showShortcuts ? "Hide" : "Show"} Keyboard Shortcuts
      </Button>

      {showShortcuts && (
        <div className="space-y-2">
          {["Navigation", "Interaction", "Accessibility"].map((category) => (
            <div key={category}>
              <p className="text-sm font-medium text-gray-700 mb-2">{category}</p>
              <div className="space-y-1">
                {shortcuts
                  .filter((s) => s.category === category)
                  .map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm"
                    >
                      <p>{shortcut.description}</p>
                      <kbd className="px-2 py-1 bg-white border rounded text-xs font-mono">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tabOrderVisible && (
        <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm">
          <p className="font-medium mb-2">Tab Order Viewer</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Header navigation</li>
            <li>Main content search</li>
            <li>Primary action button</li>
            <li>Form inputs</li>
            <li>Footer links</li>
          </ol>
        </div>
      )}
    </div>
  );
}
