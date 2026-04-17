"use client";

import { useState, useCallback, useEffect } from "react";
import { GlobalHeader } from "./global-header";
import { usePathname } from "next/navigation";
import { WorkspaceShell } from "./workspace-shell";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EditorLayoutProps {
  documentId: string;
  documentName?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function EditorLayout({
  documentId,
  documentName,
  icon,
  children,
}: EditorLayoutProps) {
  const pathname = usePathname();
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  // Escape exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fullscreen]);

  if (fullscreen) {
    return (
      <main
        id="main-content"
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        <header className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium truncate max-w-[300px]">
              {documentName || "Sans titre"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title="Quitter le plein écran (Echap)"
            aria-label="Quitter le plein écran"
          >
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>
        <div className="flex-1 overflow-hidden relative">{children}</div>
      </main>
    );
  }

  return (
    <WorkspaceShell
      className="bg-muted/40 relative"
      header={<GlobalHeader />}
      hideMainLandmark={true}
    >
      <main id="main-content" className="flex-1 overflow-hidden relative p-4">
        <div className="absolute inset-4 bg-background rounded-2xl shadow-premium border border-border/50 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="absolute top-2 right-2 z-10 h-8 w-8 opacity-50 hover:opacity-100 transition-opacity"
            title="Plein écran"
            aria-label="Passer en plein écran"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          {children}
        </div>
      </main>
    </WorkspaceShell>
  );
}
