"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Plus, X, FileText, Mail, Calendar, CheckSquare, Bot, Search, Settings,
  FolderPlus, UserPlus, BarChart3, FileSpreadsheet, Presentation, FormInput,
  MessageSquare, Video, Megaphone, Ticket, Package, Globe, PenLine, BookOpen
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/lib/store";
import { useCommandBarStore } from "@/stores/command-bar-store";
import { QuickComposeDialog } from "@/components/mail/quick-compose-dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RadialMenuItem {
  id: string;
  icon: React.ReactElement;
  label: string;
  color: string;
  action: () => void;
}

const STORAGE_KEY = "radial-menu-config";
const VISIBLE_SLOTS = 7; // Number of visible items in the arc at once

function loadConfig(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveConfig(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RadialMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [enabledItems, setEnabledItems] = useState<string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { setActiveRightWidget, setRightSidebarOpen } = useUIStore();
  const { setOpen: openCommandBar } = useCommandBarStore();

  useEffect(() => { setEnabledItems(loadConfig()); }, []);

  const toggleAI = useCallback(() => {
    setActiveRightWidget("chat");
    setRightSidebarOpen(true);
  }, [setActiveRightWidget, setRightSidebarOpen]);

  // ─── All possible "create new" actions ───────────────────────────────────

  const ALL_ITEMS: RadialMenuItem[] = useMemo(() => [
    { id: "doc", icon: <FileText />, label: "Document", color: "bg-blue-500", action: () => router.push("/docs?new=true") },
    { id: "mail", icon: <Mail />, label: "Email", color: "bg-amber-500", action: () => setComposeOpen(true) },
    { id: "event", icon: <Calendar />, label: "Événement", color: "bg-green-500", action: () => router.push("/cal?new=true") },
    { id: "task", icon: <CheckSquare />, label: "Tâche", color: "bg-purple-500", action: () => router.push("/tasks?new=true") },
    { id: "folder", icon: <FolderPlus />, label: "Dossier", color: "bg-teal-500", action: () => router.push("/drive?new=folder") },
    { id: "contact", icon: <UserPlus />, label: "Contact", color: "bg-pink-500", action: () => router.push("/contacts?new=true") },
    { id: "sheet", icon: <FileSpreadsheet />, label: "Feuille", color: "bg-emerald-500", action: () => router.push("/sheets?new=true") },
    { id: "slide", icon: <Presentation />, label: "Présentation", color: "bg-orange-500", action: () => router.push("/slides?new=true") },
    { id: "form", icon: <FormInput />, label: "Formulaire", color: "bg-sky-500", action: () => router.push("/forms?new=true") },
    { id: "channel", icon: <MessageSquare />, label: "Canal chat", color: "bg-violet-500", action: () => router.push("/chat?new=true") },
    { id: "meeting", icon: <Video />, label: "Réunion", color: "bg-rose-500", action: () => router.push("/meet?new=true") },
    { id: "announce", icon: <Megaphone />, label: "Annonce", color: "bg-yellow-500", action: () => router.push("/comms/announcements?new=true") },
    { id: "ticket", icon: <Ticket />, label: "Ticket", color: "bg-red-500", action: () => router.push("/it-assets/tickets?new=true") },
    { id: "deal", icon: <BarChart3 />, label: "Deal CRM", color: "bg-lime-500", action: () => router.push("/crm?new=deal") },
    { id: "wiki", icon: <BookOpen />, label: "Page Wiki", color: "bg-cyan-600", action: () => router.push("/wiki?new=true") },
    { id: "social", icon: <Globe />, label: "Post Social", color: "bg-fuchsia-500", action: () => router.push("/social?compose=true") },
    { id: "whiteboard", icon: <PenLine />, label: "Tableau blanc", color: "bg-stone-500", action: () => router.push("/whiteboard") },
    { id: "ai", icon: <Bot />, label: "AI Chat", color: "bg-cyan-500", action: toggleAI },
    { id: "search", icon: <Search />, label: "Recherche", color: "bg-indigo-500", action: () => openCommandBar(true) },
    { id: "settings", icon: <Settings />, label: "Paramètres", color: "bg-gray-500", action: () => router.push("/settings") },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [toggleAI, openCommandBar]);

  // Filter by enabled items (customization)
  const activeItems = useMemo(() => {
    if (!enabledItems) return ALL_ITEMS;
    const ordered = enabledItems
      .map(id => ALL_ITEMS.find(i => i.id === id))
      .filter(Boolean) as RadialMenuItem[];
    // Add any new items not yet in config
    const missing = ALL_ITEMS.filter(i => !enabledItems.includes(i.id));
    return [...ordered, ...missing];
  }, [enabledItems, ALL_ITEMS]);

  const totalItems = activeItems.length;

  // ─── Scroll / carousel logic ─────────────────────────────────────────────

  // scrollOffset is the index of the first visible item
  const maxOffset = Math.max(0, totalItems - VISIBLE_SLOTS);
  const clampedOffset = Math.min(Math.max(0, scrollOffset), maxOffset);
  const visibleItems = activeItems.slice(clampedOffset, clampedOffset + VISIBLE_SLOTS);

  // Mouse position determines scroll direction
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // FAB center
    const fabCenterX = rect.right - 28; // 14px half of w-14
    const fabCenterY = rect.bottom - 28;
    // Mouse angle relative to FAB center
    const dx = e.clientX - fabCenterX;
    const dy = e.clientY - fabCenterY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // If mouse is near the "left" edge of the arc (< -160°), scroll up (show earlier items)
    // If mouse is near the "top" edge of the arc (> -100°), scroll down (show later items)
    if (angle < -160 && clampedOffset > 0) {
      setScrollOffset(prev => Math.max(0, prev - 1));
    } else if (angle > -100 && angle < -80 && clampedOffset < maxOffset) {
      setScrollOffset(prev => Math.min(maxOffset, prev + 1));
    }
  }, [isOpen, clampedOffset, maxOffset]);

  // Mouse wheel scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isOpen) return;
    e.preventDefault();
    setScrollOffset(prev => {
      const next = prev + (e.deltaY > 0 ? 1 : -1);
      return Math.min(Math.max(0, next), maxOffset);
    });
  }, [isOpen, maxOffset]);

  // ─── Arc geometry ────────────────────────────────────────────────────────

  const radius = 130;
  const startAngle = -180; // left
  const endAngle = -90;    // top
  const angleStep = VISIBLE_SLOTS > 1 ? (endAngle - startAngle) / (VISIBLE_SLOTS - 1) : 0;

  // Size scaling: center item is biggest, edges are smaller
  const getScale = (index: number) => {
    const center = (VISIBLE_SLOTS - 1) / 2;
    const distance = Math.abs(index - center) / center; // 0 at center, 1 at edges
    return 1.3 - distance * 0.5; // 1.3x at center, 0.8x at edges
  };

  // ─── Close handlers ──────────────────────────────────────────────────────

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

  useEffect(() => {
    if (!isOpen && !showCustomize) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsOpen(false); setShowCustomize(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, showCustomize]);

  // Reset scroll when opening
  useEffect(() => { if (isOpen) setScrollOffset(0); }, [isOpen]);

  const handleFabPointerDown = () => {
    const timer = setTimeout(() => { setShowCustomize(true); setIsOpen(false); }, 600);
    setLongPressTimer(timer);
  };
  const handleFabPointerUp = () => {
    if (longPressTimer) { clearTimeout(longPressTimer); setLongPressTimer(null); }
  };

  // ─── Customization ──────────────────────────────────────────────────────

  const toggleItem = (id: string) => {
    const current = enabledItems ?? ALL_ITEMS.map(i => i.id);
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    setEnabledItems(next);
    saveConfig(next);
  };
  const moveItem = (id: string, dir: "up" | "down") => {
    const current = enabledItems ?? ALL_ITEMS.map(i => i.id);
    const idx = current.indexOf(id);
    if (idx === -1) return;
    const next = [...current];
    if (dir === "up" && idx > 0) [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    else if (dir === "down" && idx < next.length - 1) [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setEnabledItems(next);
    saveConfig(next);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <div
        ref={containerRef}
        className="fixed bottom-6 right-20 z-[100] hidden md:block"
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
      >
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-[99]"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Scroll indicators */}
        {isOpen && clampedOffset > 0 && (
          <div className="absolute z-[101] text-muted-foreground text-[10px]"
            style={{ transform: `translate(${Math.cos(-180 * Math.PI / 180) * (radius + 30)}px, ${Math.sin(-180 * Math.PI / 180) * (radius + 30)}px)` }}>
            ← plus
          </div>
        )}
        {isOpen && clampedOffset < maxOffset && (
          <div className="absolute z-[101] text-muted-foreground text-[10px]"
            style={{ transform: `translate(${Math.cos(-90 * Math.PI / 180) * (radius + 30)}px, ${Math.sin(-90 * Math.PI / 180) * (radius + 30)}px)` }}>
            ↑ plus
          </div>
        )}

        {/* Radial items */}
        <div className="relative z-[101] flex items-center justify-center">
          {visibleItems.map((item, i) => {
            const angle = (startAngle + i * angleStep) * (Math.PI / 180);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const scale = getScale(i);
            const size = Math.round(44 * scale);
            const iconSize = Math.round(18 * scale);

            return (
              <div
                key={item.id}
                className="absolute"
                style={{
                  transform: isOpen
                    ? `translate(${x}px, ${y}px) scale(${scale})`
                    : "translate(0px, 0px) scale(0.3)",
                  transition: isOpen
                    ? `transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 50}ms, opacity 250ms ease ${i * 50}ms`
                    : `transform 200ms ease ${(VISIBLE_SLOTS - i) * 30}ms, opacity 150ms ease`,
                  opacity: isOpen ? 1 : 0,
                  pointerEvents: isOpen ? "auto" : "none",
                  zIndex: 50 + Math.round((1 - Math.abs(i - (VISIBLE_SLOTS - 1) / 2)) * 10),
                }}
              >
                <button
                  onClick={() => { item.action(); setIsOpen(false); }}
                  className={cn(
                    "group relative rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-150 hover:brightness-110 active:scale-90",
                    item.color
                  )}
                  style={{ width: size, height: size }}
                  title={item.label}
                >
                  {React.cloneElement(item.icon, {
                    style: { width: iconSize, height: iconSize },
                  } as React.SVGProps<SVGSVGElement>)}
                  {/* Tooltip */}
                  <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover border border-border px-2 py-0.5 text-[10px] font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
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
            onContextMenu={(e) => { e.preventDefault(); setShowCustomize(true); setIsOpen(false); }}
            className={cn(
              "relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300",
              isOpen ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            )}
            title={isOpen ? "Fermer" : "Actions rapides (clic long pour personnaliser)"}
          >
            <div className={cn("transition-transform duration-300", isOpen ? "rotate-45" : "rotate-0")}>
              {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
            </div>
          </button>
        </div>

        {/* Scroll position indicator */}
        {isOpen && totalItems > VISIBLE_SLOTS && (
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-[101]">
            {Array.from({ length: Math.ceil(totalItems / VISIBLE_SLOTS) }, (_, i) => (
              <div key={i} className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                Math.floor(clampedOffset / VISIBLE_SLOTS) === i ? "bg-primary" : "bg-muted-foreground/30"
              )} />
            ))}
          </div>
        )}

        {/* Customization panel */}
        {showCustomize && (
          <div className="absolute bottom-16 right-0 w-64 max-h-[70vh] rounded-xl border border-border bg-popover shadow-xl p-3 z-[102] animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">Personnaliser le menu</p>
              <button onClick={() => setShowCustomize(false)} className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">Activer/désactiver et réordonner les actions</p>
            <div className="space-y-1 max-h-[55vh] overflow-y-auto">
              {ALL_ITEMS.map((item, idx) => {
                const isEnabled = !enabledItems || enabledItems.includes(item.id);
                return (
                  <div key={item.id} className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-opacity",
                    isEnabled ? "bg-muted/50" : "bg-muted/20 opacity-50"
                  )}>
                    <button onClick={() => toggleItem(item.id)} className="shrink-0">
                      <div className={cn(
                        "h-5 w-5 rounded-full flex items-center justify-center text-white shrink-0 transition-all",
                        isEnabled ? item.color : "bg-muted-foreground/30"
                      )}>
                        {React.cloneElement(item.icon, { className: "h-3 w-3" } as React.HTMLAttributes<SVGElement>)}
                      </div>
                    </button>
                    <span className="flex-1 truncate">{item.label}</span>
                    {isEnabled && idx > 0 && (
                      <button onClick={() => moveItem(item.id, "up")} className="text-muted-foreground hover:text-foreground p-0.5 rounded text-[10px]">▲</button>
                    )}
                    {isEnabled && idx < ALL_ITEMS.length - 1 && (
                      <button onClick={() => moveItem(item.id, "down")} className="text-muted-foreground hover:text-foreground p-0.5 rounded text-[10px]">▼</button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => { setEnabledItems(null); localStorage.removeItem(STORAGE_KEY); }}
              className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center py-1.5 mt-2 rounded hover:bg-muted transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      <QuickComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </>
  );
}
