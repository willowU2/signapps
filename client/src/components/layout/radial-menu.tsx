"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, FileText, Mail, Calendar, CheckSquare, Bot, Search, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/store";
import { useCommandBarStore } from "@/stores/command-bar-store";
import { QuickComposeDialog } from "@/components/mail/quick-compose-dialog";

interface RadialMenuItem {
  id: string;
  icon: React.ReactElement;
  label: string;
  color: string; // tailwind bg color
  action: () => void;
}

const STORAGE_KEY = "radial-menu-config";

function loadOrder(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
    return null;
  } catch {
    return null;
  }
}

function saveOrder(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

export function RadialMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [itemOrder, setItemOrder] = useState<string[] | null>(null);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const { setActiveRightWidget, setRightSidebarOpen } = useUIStore();
  const { setOpen: openCommandBar } = useCommandBarStore();

  // Load item order from localStorage on mount
  useEffect(() => {
    setItemOrder(loadOrder());
  }, []);

  const toggleAI = useCallback(() => {
    setActiveRightWidget("chat");
    setRightSidebarOpen(true);
  }, [setActiveRightWidget, setRightSidebarOpen]);

  const allItems: RadialMenuItem[] = [
    {
      id: "doc",
      icon: <FileText />,
      label: "Document",
      color: "bg-blue-500 hover:bg-blue-600",
      action: () => router.push("/docs?new=true"),
    },
    {
      id: "mail",
      icon: <Mail />,
      label: "Mail",
      color: "bg-amber-500 hover:bg-amber-600",
      action: () => setComposeOpen(true),
    },
    {
      id: "event",
      icon: <Calendar />,
      label: "Événement",
      color: "bg-green-500 hover:bg-green-600",
      action: () => router.push("/cal?new=true"),
    },
    {
      id: "task",
      icon: <CheckSquare />,
      label: "Tâche",
      color: "bg-purple-500 hover:bg-purple-600",
      action: () => router.push("/tasks?new=true"),
    },
    {
      id: "ai",
      icon: <Bot />,
      label: "AI",
      color: "bg-cyan-500 hover:bg-cyan-600",
      action: toggleAI,
    },
    {
      id: "search",
      icon: <Search />,
      label: "Recherche",
      color: "bg-indigo-500 hover:bg-indigo-600",
      action: () => openCommandBar(true),
    },
    {
      id: "settings",
      icon: <Settings />,
      label: "Paramètres",
      color: "bg-gray-500 hover:bg-gray-600",
      action: () => router.push("/settings"),
    },
  ];

  // Apply saved order
  const orderedItems = itemOrder
    ? [
        ...itemOrder.map((id) => allItems.find((i) => i.id === id)).filter(Boolean) as RadialMenuItem[],
        ...allItems.filter((i) => !itemOrder.includes(i.id)),
      ]
    : allItems;

  // Only show first 8 items
  const visibleItems = orderedItems.slice(0, 8);

  // Arrange in a quarter-circle: bottom-left to top-right (90° arc)
  const radius = 120; // px
  const startAngle = -180; // left
  const endAngle = -90; // top
  const angleStep = visibleItems.length > 1
    ? (endAngle - startAngle) / (visibleItems.length - 1)
    : 0;

  // Close on click outside
  useEffect(() => {
    if (!isOpen && !showCustomize) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCustomize(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, showCustomize]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen && !showCustomize) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setShowCustomize(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, showCustomize]);

  const handleFabPointerDown = () => {
    const timer = setTimeout(() => {
      setShowCustomize(true);
      setIsOpen(false);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleFabPointerUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const moveItem = (id: string, direction: "up" | "down") => {
    const current = itemOrder ?? allItems.map((i) => i.id);
    const idx = current.indexOf(id);
    if (idx === -1) return;
    const newOrder = [...current];
    if (direction === "up" && idx > 0) {
      [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    } else if (direction === "down" && idx < newOrder.length - 1) {
      [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
    }
    setItemOrder(newOrder);
    saveOrder(newOrder);
  };

  const resetOrder = () => {
    setItemOrder(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <>
      <div
        ref={containerRef}
        className="fixed bottom-6 right-20 z-50 hidden md:block"
        // Right offset to not overlap with right sidebar icon bar (w-16)
      >
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-40"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Radial items */}
        <div className="relative z-50 flex items-center justify-center">
          {visibleItems.map((item, i) => {
            const angle = (startAngle + i * angleStep) * (Math.PI / 180);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <div
                key={item.id}
                className="absolute"
                style={{
                  transform: isOpen
                    ? `translate(${x}px, ${y}px)`
                    : "translate(0px, 0px)",
                  transition: isOpen
                    ? `transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 40}ms, opacity 200ms ease ${i * 40}ms`
                    : `transform 200ms ease ${(visibleItems.length - i) * 30}ms, opacity 150ms ease`,
                  opacity: isOpen ? 1 : 0,
                  pointerEvents: isOpen ? "auto" : "none",
                }}
              >
                {/* Label tooltip */}
                <div
                  className={cn(
                    "absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap",
                    "rounded-md bg-popover border border-border px-2 py-0.5 text-[10px] font-medium shadow-md",
                    "opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  )}
                >
                  {item.label}
                </div>
                <button
                  onClick={() => {
                    item.action();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "group relative w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95",
                    item.color
                  )}
                  title={item.label}
                >
                  {React.cloneElement(item.icon, {
                    className: "h-[18px] w-[18px]",
                  } as React.HTMLAttributes<SVGElement>)}
                  {/* Tooltip */}
                  <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover border border-border px-2 py-0.5 text-[10px] font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {item.label}
                  </span>
                </button>
              </div>
            );
          })}

          {/* FAB trigger */}
          <button
            onClick={() => !showCustomize && setIsOpen(!isOpen)}
            onPointerDown={handleFabPointerDown}
            onPointerUp={handleFabPointerUp}
            onPointerLeave={handleFabPointerUp}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowCustomize(true);
              setIsOpen(false);
            }}
            className={cn(
              "relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300",
              isOpen ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            )}
            title={isOpen ? "Fermer" : "Actions rapides (long-press pour personnaliser)"}
          >
            <div
              className={cn(
                "transition-transform duration-300",
                isOpen ? "rotate-45" : "rotate-0"
              )}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </div>
          </button>
        </div>

        {/* Customization panel */}
        {showCustomize && (
          <div className="absolute bottom-16 right-0 w-56 rounded-xl border border-border bg-popover shadow-xl p-3 space-y-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold">Personnaliser le menu</p>
              <button
                onClick={() => setShowCustomize(false)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">Réordonner les 8 premiers éléments affichés</p>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {(itemOrder ?? allItems.map((i) => i.id)).map((id, idx) => {
                const item = allItems.find((i) => i.id === id);
                if (!item) return null;
                return (
                  <div key={id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-muted/50 text-xs">
                    <span className={cn("h-5 w-5 rounded-full flex items-center justify-center text-white shrink-0", item.color.split(" ")[0])}>
                      {React.cloneElement(item.icon, { className: "h-3 w-3" } as React.HTMLAttributes<SVGElement>)}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {idx > 0 && (
                      <button onClick={() => moveItem(id, "up")} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                        ▲
                      </button>
                    )}
                    {idx < allItems.length - 1 && (
                      <button onClick={() => moveItem(id, "down")} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                        ▼
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={resetOrder}
              className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center py-1 rounded hover:bg-muted transition-colors"
            >
              Réinitialiser l&apos;ordre
            </button>
          </div>
        )}
      </div>

      {/* Quick compose dialog */}
      <QuickComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </>
  );
}
