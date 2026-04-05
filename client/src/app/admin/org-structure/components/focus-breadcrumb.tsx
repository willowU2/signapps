"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FocusBreadcrumbProps {
  breadcrumb: string[];
  onExit: () => void;
}

export function FocusBreadcrumb({ breadcrumb, onExit }: FocusBreadcrumbProps) {
  return (
    <div className="px-4 py-2.5 border-b border-border bg-card shrink-0 flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 h-8"
        onClick={onExit}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Retour
      </Button>
      <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-hidden">
        {breadcrumb.map((name, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
            <span
              className={cn(
                "truncate",
                idx === breadcrumb.length - 1 &&
                  "text-foreground font-semibold",
              )}
            >
              {name}
            </span>
          </React.Fragment>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 h-8 ml-auto"
        onClick={onExit}
      >
        <Minimize2 className="h-4 w-4 mr-1" />
        Quitter le focus
      </Button>
    </div>
  );
}
