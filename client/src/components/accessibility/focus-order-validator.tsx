"use client";

import { useState, useCallback } from "react";
import { CheckCircle, AlertCircle, List, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FocusItem {
  index: number;
  tag: string;
  text: string;
  tabIndex: number;
  issues: string[];
}

export function FocusOrderValidator() {
  const [results, setResults] = useState<FocusItem[] | null>(null);
  const [open, setOpen] = useState(false);

  const runValidation = useCallback(() => {
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(", ");

    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(focusableSelector),
    );
    const items: FocusItem[] = elements.slice(0, 50).map((el, i) => {
      const issues: string[] = [];
      const text = (
        el.textContent ||
        el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        ""
      )
        .trim()
        .slice(0, 60);
      const tabIdx = el.tabIndex;

      if (!text) issues.push("No accessible label");
      if (tabIdx > 0)
        issues.push(`tabindex=${tabIdx} (positive value disrupts order)`);
      const style = window.getComputedStyle(el);
      if (style.outline === "none" && !el.classList.contains("focus-visible")) {
        issues.push("Possibly missing focus style");
      }

      return {
        index: i + 1,
        tag: el.tagName.toLowerCase(),
        text: text || "(empty)",
        tabIndex: tabIdx,
        issues,
      };
    });
    setResults(items);
    setOpen(true);
  }, []);

  const totalIssues =
    results?.reduce((sum, r) => sum + r.issues.length, 0) ?? 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={runValidation}
        className="gap-1.5"
      >
        <List className="h-4 w-4" />
        Validate Focus Order
      </Button>

      {open && results && (
        <div className="fixed inset-0 z-[9998] bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">
                  Focus Order Validation
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {results.length} focusable elements —{" "}
                  {totalIssues === 0 ? (
                    <span className="text-green-600">No issues found</span>
                  ) : (
                    <span className="text-amber-600">
                      {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="space-y-1.5">
                  {results.map((item) => (
                    <div
                      key={item.index}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border text-sm ${
                        item.issues.length > 0
                          ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                          : "border-border bg-muted/20"
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {item.index}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-xs font-mono px-1.5 py-0"
                          >
                            {item.tag}
                          </Badge>
                          <span className="truncate">{item.text}</span>
                        </div>
                        {item.issues.map((issue, i) => (
                          <p
                            key={i}
                            className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3 w-3" />
                            {issue}
                          </p>
                        ))}
                      </div>
                      {item.issues.length === 0 && (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
