"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Plus,
  X,
  FileText,
  Mail,
  Calendar,
  CheckSquare,
  Bot,
  Search,
  Settings,
  FolderPlus,
  UserPlus,
  BarChart3,
  FileSpreadsheet,
  Presentation,
  FormInput,
  MessageSquare,
  Video,
  Megaphone,
  Ticket,
  Package,
  Globe,
  PenLine,
  BookOpen,
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
const VISIBLE_SLOTS = 5; // Number of visible items in the arc at once

function loadConfig(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveConfig(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {}
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RadialMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [enabledItems, setEnabledItems] = useState<string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { setActiveRightWidget, setRightSidebarOpen } = useUIStore();
  const { setOpen: openCommandBar } = useCommandBarStore();

  // ── Drag state — allows repositioning the FAB like the AI chat button ──
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0, startX: 0, startY: 0, moved: false });

  useEffect(() => {
    setEnabledItems(loadConfig());
    try {
      const saved = localStorage.getItem("radial-fab-pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        const maxX = 0;
        const minX = -window.innerWidth + 80;
        const minY = -window.innerHeight + 140;
        const maxY = 0;
        const clampedX = Math.max(minX, Math.min(maxX, parsed.x || 0));
        const clampedY = Math.max(minY, Math.min(maxY, parsed.y || 0));
        setPosition({ x: clampedX, y: clampedY });
      }
    } catch {}
  }, []);

  // ── Drag handlers ──
  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isOpen || showCustomize) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        x: position.x,
        y: position.y,
        moved: false,
      };
    },
    [isOpen, showCustomize, position.x, position.y],
  );

  const handleDragPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (!dragRef.current.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        dragRef.current.moved = true;
        setIsDragging(true);
        // Cancel any pending long-press so drag doesn't trigger "customize"
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
      }
      if (dragRef.current.moved) {
        setPosition({ x: dragRef.current.x + dx, y: dragRef.current.y + dy });
      }
    },
    [longPressTimer],
  );

  const handleDragPointerUp = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      if (dragRef.current.moved) {
        setTimeout(() => setIsDragging(false), 50);
        try {
          localStorage.setItem("radial-fab-pos", JSON.stringify(position));
        } catch {}
      } else {
        setIsDragging(false);
      }
    },
    [position],
  );

  const toggleAI = useCallback(() => {
    setActiveRightWidget("chat");
    setRightSidebarOpen(true);
  }, [setActiveRightWidget, setRightSidebarOpen]);

  // ─── All possible "create new" actions ───────────────────────────────────

  const ALL_ITEMS: RadialMenuItem[] = useMemo(
    () => [
      {
        id: "doc",
        icon: <FileText />,
        label: "Nouveau Document",
        color: "bg-blue-500",
        action: () => router.push("/docs?new=true"),
      },
      {
        id: "mail",
        icon: <Mail />,
        label: "Nouveau Email",
        color: "bg-amber-500",
        action: () => setComposeOpen(true),
      },
      {
        id: "event",
        icon: <Calendar />,
        label: "Nouvel Événement",
        color: "bg-green-500",
        action: () => router.push("/cal?new=true"),
      },
      {
        id: "task",
        icon: <CheckSquare />,
        label: "Nouvelle Tâche",
        color: "bg-purple-500",
        action: () => router.push("/tasks?new=true"),
      },
      {
        id: "folder",
        icon: <FolderPlus />,
        label: "Nouveau Dossier",
        color: "bg-teal-500",
        action: () => router.push("/drive?new=folder"),
      },
      {
        id: "contact",
        icon: <UserPlus />,
        label: "Nouveau Contact",
        color: "bg-pink-500",
        action: () => router.push("/contacts?new=true"),
      },
      {
        id: "sheet",
        icon: <FileSpreadsheet />,
        label: "Nouvelle Feuille",
        color: "bg-emerald-500",
        action: () => router.push("/sheets?new=true"),
      },
      {
        id: "slide",
        icon: <Presentation />,
        label: "Nouvelle Présentation",
        color: "bg-orange-500",
        action: () => router.push("/slides?new=true"),
      },
      {
        id: "form",
        icon: <FormInput />,
        label: "Nouveau Formulaire",
        color: "bg-sky-500",
        action: () => router.push("/forms?new=true"),
      },
      {
        id: "channel",
        icon: <MessageSquare />,
        label: "Nouveau Canal",
        color: "bg-violet-500",
        action: () => router.push("/chat?new=true"),
      },
      {
        id: "meeting",
        icon: <Video />,
        label: "Nouvelle Réunion",
        color: "bg-rose-500",
        action: () => router.push("/meet?new=true"),
      },
      {
        id: "announce",
        icon: <Megaphone />,
        label: "Nouvelle Annonce",
        color: "bg-yellow-500",
        action: () => router.push("/comms/announcements?new=true"),
      },
      {
        id: "ticket",
        icon: <Ticket />,
        label: "Nouveau Ticket",
        color: "bg-red-500",
        action: () => router.push("/it-assets/tickets?new=true"),
      },
      {
        id: "deal",
        icon: <BarChart3 />,
        label: "Nouveau Deal",
        color: "bg-lime-500",
        action: () => router.push("/crm?new=deal"),
      },
      {
        id: "wiki",
        icon: <BookOpen />,
        label: "Nouvelle Page Wiki",
        color: "bg-cyan-600",
        action: () => router.push("/wiki?new=true"),
      },
      {
        id: "social",
        icon: <Globe />,
        label: "Nouveau Post",
        color: "bg-fuchsia-500",
        action: () => router.push("/social?compose=true"),
      },
      {
        id: "whiteboard",
        icon: <PenLine />,
        label: "Nouveau Tableau",
        color: "bg-stone-500",
        action: () => router.push("/whiteboard"),
      },
      {
        id: "ai",
        icon: <Bot />,
        label: "Nouveau Chat AI",
        color: "bg-cyan-500",
        action: toggleAI,
      },
      {
        id: "search",
        icon: <Search />,
        label: "Rechercher",
        color: "bg-indigo-500",
        action: () => openCommandBar(true),
      },
      {
        id: "settings",
        icon: <Settings />,
        label: "Paramètres",
        color: "bg-gray-500",
        action: () => router.push("/settings"),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toggleAI, openCommandBar],
  );

  // Filter by enabled items (customization)
  const activeItems = useMemo(() => {
    if (!enabledItems) return ALL_ITEMS;
    const ordered = enabledItems
      .map((id) => ALL_ITEMS.find((i) => i.id === id))
      .filter(Boolean) as RadialMenuItem[];
    // Add any new items not yet in config
    const missing = ALL_ITEMS.filter((i) => !enabledItems.includes(i.id));
    return [...ordered, ...missing];
  }, [enabledItems, ALL_ITEMS]);

  const totalItems = activeItems.length;

  // ─── Scroll / carousel logic ─────────────────────────────────────────────

  // scrollOffset is the index of the first visible item
  const maxOffset = Math.max(0, totalItems - VISIBLE_SLOTS);
  const clampedOffset = Math.min(Math.max(0, scrollOffset), maxOffset);
  const visibleItems = activeItems.slice(
    clampedOffset,
    clampedOffset + VISIBLE_SLOTS,
  );

  // (Previous mouse-position auto-scroll was too jittery — replaced by
  // explicit wheel scroll only.)

  // Mouse wheel scroll
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!isOpen) return;
      e.preventDefault();
      setScrollOffset((prev) => {
        const next = prev + (e.deltaY > 0 ? 1 : -1);
        return Math.min(Math.max(0, next), maxOffset);
      });
    },
    [isOpen, maxOffset],
  );

  // ─── Arc geometry ────────────────────────────────────────────────────────

  // Full circle layout — evenly distribute VISIBLE_SLOTS items around 360°.
  // Starts at 12 o'clock (-90°) and goes clockwise.
  const radius = 220;
  const angleStep = 360 / VISIBLE_SLOTS;
  const startAngle = -90; // top
  // All items same size when laid out evenly on a circle.
  const getScale = () => 1;

  // ─── Close handlers ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen && !showCustomize) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
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
      if (e.key === "Escape") {
        setIsOpen(false);
        setShowCustomize(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, showCustomize]);

  // Reset scroll when opening
  useEffect(() => {
    if (isOpen) setScrollOffset(0);
  }, [isOpen]);

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

  // ─── Customization ──────────────────────────────────────────────────────

  const toggleItem = (id: string) => {
    const current = enabledItems ?? ALL_ITEMS.map((i) => i.id);
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    setEnabledItems(next);
    saveConfig(next);
  };
  const moveItem = (id: string, dir: "up" | "down") => {
    const current = enabledItems ?? ALL_ITEMS.map((i) => i.id);
    const idx = current.indexOf(id);
    if (idx === -1) return;
    const next = [...current];
    if (dir === "up" && idx > 0)
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    else if (dir === "down" && idx < next.length - 1)
      [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setEnabledItems(next);
    saveConfig(next);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          "hidden md:block z-[100]",
          isOpen ? "fixed inset-0" : "fixed bottom-[72px] right-[8px]",
        )}
        style={
          !isOpen
            ? {
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: isDragging
                  ? "none"
                  : "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
              }
            : undefined
        }
        onWheel={handleWheel}
      >
        {/* Full-screen backdrop with gradient blur when open */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-background/60 backdrop-blur-md z-[99] animate-in fade-in duration-300"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Radial items + FAB cluster */}
        <div
          className={cn(
            "z-[101] flex items-center justify-center",
            isOpen
              ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              : "relative",
          )}
        >
          {/* Decorative ring when open */}
          {isOpen && (
            <div
              className="absolute rounded-full border border-primary/20 animate-in fade-in zoom-in-50 duration-500 pointer-events-none"
              style={{
                width: radius * 2 + 80,
                height: radius * 2 + 80,
              }}
            />
          )}
          {isOpen && (
            <div
              className="absolute rounded-full border border-primary/10 pointer-events-none"
              style={{
                width: radius * 2,
                height: radius * 2,
              }}
            />
          )}

          {visibleItems.map((item, i) => {
            const angle = (startAngle + i * angleStep) * (Math.PI / 180);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const scale = getScale();
            const size = Math.round(64 * scale);
            const iconSize = Math.round(26 * scale);

            return (
              <div
                key={item.id}
                className="absolute"
                style={{
                  transform: isOpen
                    ? `translate(${x}px, ${y}px) scale(${scale})`
                    : "translate(0px, 0px) scale(0.3)",
                  transition: `transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1) ${isOpen ? i * 50 : (VISIBLE_SLOTS - i) * 25}ms, opacity 300ms ease ${isOpen ? i * 50 : 0}ms`,
                  opacity: isOpen ? 1 : 0,
                  pointerEvents: isOpen ? "auto" : "none",
                }}
              >
                <button
                  onClick={() => {
                    item.action();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "group relative rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-2xl hover:scale-110 active:scale-90 transition-all duration-200",
                    item.color,
                  )}
                  style={{ width: size, height: size }}
                  title={item.label}
                >
                  {React.cloneElement(item.icon, {
                    style: { width: iconSize, height: iconSize },
                  } as React.SVGProps<SVGSVGElement>)}
                  {/* Tooltip on hover */}
                  <span className="absolute top-full mt-2 px-3 py-1 rounded-lg bg-popover text-popover-foreground text-xs font-medium shadow-lg border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              </div>
            );
          })}

          {/* FAB trigger (center when open, anchor when closed) */}
          <button
            onClick={() => {
              if (isDragging || dragRef.current.moved) return;
              if (!showCustomize) setIsOpen(!isOpen);
            }}
            onPointerDown={(e) => {
              handleDragPointerDown(e);
              handleFabPointerDown();
            }}
            onPointerMove={handleDragPointerMove}
            onPointerUp={(e) => {
              handleDragPointerUp(e);
              handleFabPointerUp();
            }}
            onPointerCancel={(e) => {
              handleDragPointerUp(e);
              handleFabPointerUp();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowCustomize(true);
              setIsOpen(false);
            }}
            className={cn(
              "relative z-10 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 touch-none",
              isOpen
                ? "w-20 h-20 bg-destructive hover:bg-destructive/90 shadow-2xl cursor-pointer"
                : isDragging
                  ? "w-14 h-14 bg-primary cursor-grabbing scale-105 shadow-2xl"
                  : "w-14 h-14 bg-primary hover:bg-primary/90 cursor-grab",
            )}
            title={
              isOpen
                ? "Fermer"
                : "Clic : ouvrir · Glisser : déplacer · Clic long : personnaliser"
            }
          >
            <div
              className={cn(
                "transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                isOpen ? "rotate-[225deg]" : "rotate-0",
              )}
            >
              {isOpen ? (
                <X className="h-8 w-8" />
              ) : (
                <Plus className="h-6 w-6" />
              )}
            </div>
          </button>
        </div>

        {/* Center label — shown above the FAB when open */}
        {isOpen &&
          (() => {
            const centerIdx = Math.floor((VISIBLE_SLOTS - 1) / 2);
            const globalCenter = clampedOffset + centerIdx;
            const prev =
              globalCenter > 0 ? activeItems[globalCenter - 1] : null;
            const curr = activeItems[globalCenter];
            const next =
              globalCenter < totalItems - 1
                ? activeItems[globalCenter + 1]
                : null;
            return (
              <div
                className="fixed z-[110] select-none pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{
                  top: `calc(50% - ${radius + 90}px)`,
                  left: "50%",
                  transform: "translateX(-50%)",
                }}
              >
                <div className="rounded-2xl bg-card/90 backdrop-blur-md border border-border/50 shadow-2xl px-6 py-3 flex items-center gap-3">
                  {prev && (
                    <span className="text-xs text-muted-foreground/60 truncate max-w-[120px]">
                      {prev.label}
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground/30 font-light">
                    {"«"}
                  </span>
                  {curr && (
                    <span className="text-base font-bold text-foreground uppercase tracking-wider">
                      {curr.label}
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground/30 font-light">
                    {"»"}
                  </span>
                  {next && (
                    <span className="text-[12px] text-muted-foreground/50 truncate max-w-[120px]">
                      {next.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

        {/* Customization panel */}
        {showCustomize && (
          <div className="absolute bottom-16 right-0 w-64 max-h-[70vh] rounded-xl border border-border bg-popover shadow-xl p-3 z-[102] animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">Personnaliser le menu</p>
              <button
                onClick={() => setShowCustomize(false)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">
              Activer/désactiver et réordonner les actions
            </p>
            <div className="space-y-1 max-h-[55vh] overflow-y-auto">
              {ALL_ITEMS.map((item, idx) => {
                const isEnabled =
                  !enabledItems || enabledItems.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-opacity",
                      isEnabled ? "bg-muted/50" : "bg-muted/20 opacity-50",
                    )}
                  >
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="shrink-0"
                    >
                      <div
                        className={cn(
                          "h-5 w-5 rounded-full flex items-center justify-center text-white shrink-0 transition-all",
                          isEnabled ? item.color : "bg-muted-foreground/30",
                        )}
                      >
                        {React.cloneElement(item.icon, {
                          className: "h-3 w-3",
                        } as React.HTMLAttributes<SVGElement>)}
                      </div>
                    </button>
                    <span className="flex-1 truncate">{item.label}</span>
                    {isEnabled && idx > 0 && (
                      <button
                        onClick={() => moveItem(item.id, "up")}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded text-[10px]"
                      >
                        ▲
                      </button>
                    )}
                    {isEnabled && idx < ALL_ITEMS.length - 1 && (
                      <button
                        onClick={() => moveItem(item.id, "down")}
                        className="text-muted-foreground hover:text-foreground p-0.5 rounded text-[10px]"
                      >
                        ▼
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => {
                setEnabledItems(null);
                localStorage.removeItem(STORAGE_KEY);
              }}
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
