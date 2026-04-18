"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUIStore, RightWidgetType } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  StickyNote,
  X,
  ChevronRight,
  Pin,
  Search,
  Mail,
  Users,
  FileText,
  HardDrive,
  BarChart2,
  Smartphone,
  CreditCard,
  Share2,
  Clock,
  Grid,
} from "lucide-react";
// AQ-PERF: lazy-load arbitrary lucide icons by name without pulling the
// full ~1.5k-icon barrel into the client bundle.  See sidebar.tsx for
// the same pattern.
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TooltipIconButton } from "@/components/ui/tooltip-icon-button";

import { ChatWidget } from "@/components/chat/chat-widget";
import { CalendarWidget } from "@/components/calendar/calendar-widget";
import { TasksWidget } from "@/components/tasks/tasks-widget";
import { APP_CATEGORIES } from "@/lib/app-registry";
import { useAppRegistry } from "@/hooks/use-app-registry";

const LUCIDE_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function DynIcon({ name, className }: { name: string; className?: string }) {
  const kebab = name
    .replace(/([A-Z])/g, "-$1")
    .replace(/^-/, "")
    .toLowerCase();
  if (!LUCIDE_NAME_RE.test(kebab)) {
    return <Grid className={className} />;
  }
  return (
    <DynamicIcon
      name={kebab as IconName}
      className={className}
      fallback={() => <Grid className={className} />}
    />
  );
}

const widgetItems = [
  { id: "chat" as RightWidgetType, icon: Bot, label: "AI Assistant" },
  { id: "calendar" as RightWidgetType, icon: CalendarDays, label: "Calendar" },
  { id: "tasks" as RightWidgetType, icon: CheckSquare, label: "Tasks" },
  { id: "notes" as RightWidgetType, icon: StickyNote, label: "Keep Notes" },
] as const;

// Route-to-context mapping: defines which icon-bar widgets + panel content to show
interface RouteContext {
  label: string;
  icons: { id: RightWidgetType; icon: React.ElementType; label: string }[];
}

function getRouteContext(pathname: string): RouteContext {
  if (pathname.startsWith("/mail")) {
    return {
      label: "Mail",
      icons: [
        { id: "chat", icon: Bot, label: "AI Compose" },
        { id: "notes", icon: Users, label: "Contacts" },
      ],
    };
  }
  if (pathname.startsWith("/cal")) {
    return {
      label: "Calendrier",
      icons: [
        { id: "calendar", icon: CalendarDays, label: "Événement" },
        { id: "chat", icon: Bot, label: "Préparation réunion" },
      ],
    };
  }
  if (pathname.startsWith("/tasks")) {
    return {
      label: "Tâches",
      icons: [
        { id: "tasks", icon: CheckSquare, label: "Détails tâche" },
        { id: "notes", icon: Clock, label: "Suivi temps" },
        { id: "chat", icon: Bot, label: "AI Assistant" },
      ],
    };
  }
  if (pathname.startsWith("/contacts")) {
    return {
      label: "Contacts",
      icons: [
        { id: "notes", icon: Users, label: "Contact 360" },
        { id: "chat", icon: Bot, label: "Activité" },
      ],
    };
  }
  if (pathname.startsWith("/docs")) {
    return {
      label: "Documents",
      icons: [
        { id: "notes", icon: FileText, label: "Plan du doc" },
        { id: "chat", icon: Bot, label: "AI Assistant" },
      ],
    };
  }
  if (pathname.startsWith("/storage") || pathname.startsWith("/drive")) {
    return {
      label: "Drive",
      icons: [
        { id: "notes", icon: HardDrive, label: "Aperçu fichier" },
        { id: "chat", icon: Share2, label: "Partage" },
      ],
    };
  }
  if (pathname.startsWith("/social")) {
    return {
      label: "Social",
      icons: [
        { id: "chat", icon: Bot, label: "Aperçu post" },
        { id: "notes", icon: BarChart2, label: "Analytiques" },
        { id: "tasks", icon: CalendarDays, label: "Planification" },
      ],
    };
  }
  if (pathname.startsWith("/it-assets")) {
    return {
      label: "IT Assets",
      icons: [
        { id: "notes", icon: Smartphone, label: "Détails appareil" },
        { id: "chat", icon: Bot, label: "Scripts" },
      ],
    };
  }
  if (pathname.startsWith("/billing")) {
    return {
      label: "Facturation",
      icons: [
        { id: "notes", icon: CreditCard, label: "Facture" },
        { id: "chat", icon: Bot, label: "Statut paiement" },
      ],
    };
  }
  // Default
  return {
    label: "Panel",
    icons: [
      { id: "chat", icon: Bot, label: "AI Assistant" },
      { id: "calendar", icon: CalendarDays, label: "Calendar" },
      { id: "tasks", icon: CheckSquare, label: "Tasks" },
      { id: "notes", icon: StickyNote, label: "Keep Notes" },
    ],
  };
}

export function RightSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { apps: appRegistry } = useAppRegistry();
  const {
    rightSidebarOpen,
    rightSidebarPinned,
    activeRightWidget,
    setRightSidebarOpen,
    setRightSidebarPinned,
    setActiveRightWidget,
  } = useUIStore();
  const [mounted, setMounted] = useState(false);
  const [panelMode, setPanelMode] = useState<"widget" | "apps">("widget");
  const [appSearch, setAppSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const iconBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const routeContext = useMemo(() => getRouteContext(pathname), [pathname]);

  // Close panel when clicking outside (not pinned, not on icon bar or panel itself)
  useEffect(() => {
    if (!rightSidebarOpen || rightSidebarPinned) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        iconBarRef.current &&
        !iconBarRef.current.contains(target)
      ) {
        setRightSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [rightSidebarOpen, rightSidebarPinned, setRightSidebarOpen]);

  // Force panel closed on first mount to reset any stale localStorage state
  useEffect(() => {
    if (!rightSidebarPinned) {
      setRightSidebarOpen(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = mounted ? rightSidebarOpen || rightSidebarPinned : false;

  const toggleWidget = (widget: RightWidgetType) => {
    if (
      isOpen &&
      activeRightWidget === widget &&
      panelMode === "widget" &&
      !rightSidebarPinned
    ) {
      setRightSidebarOpen(false);
    } else {
      setPanelMode("widget");
      setActiveRightWidget(widget);
    }
  };

  const openApps = () => {
    if (isOpen && panelMode === "apps" && !rightSidebarPinned) {
      setRightSidebarOpen(false);
    } else {
      setPanelMode("apps");
      setRightSidebarOpen(true);
    }
  };

  const handlePinToggle = () => {
    const newPinned = !rightSidebarPinned;
    setRightSidebarPinned(newPinned);
    if (newPinned) {
      // Ensure panel is open when pinning
      setRightSidebarOpen(true);
    }
  };

  const panelTitle =
    panelMode === "apps"
      ? "Applications"
      : routeContext.label !== "Panel"
        ? routeContext.label
        : (widgetItems.find((i) => i.id === activeRightWidget)?.label ??
          "Panel");

  const filteredApps = useMemo(() => {
    if (!appSearch.trim()) return null;
    const q = appSearch.toLowerCase();
    return appRegistry.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }, [appSearch, appRegistry]);

  const handleDragStart = (
    e: React.DragEvent,
    app: (typeof appRegistry)[0],
  ) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        href: app.href,
        icon: app.icon,
        label: app.label,
        color: app.color,
      }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  // Use route-specific icons when available, otherwise fall back to default widgetItems
  const displayedIcons = routeContext.icons;

  return (
    <>
      {/* Expanded Panel — Clipped wrapper to prevent horizontal layout overflow */}
      <div
        className={cn(
          "hidden md:flex fixed top-0 bottom-0 bg-background border-l border-border",
          "transition-all duration-300 ease-in-out z-30 overflow-hidden shadow-xl",
          isOpen ? "w-80 opacity-100" : "w-0 opacity-0 border-none",
        )}
        style={{ right: "var(--right-sidebar-icon-width)" }}
      >
        <div
          ref={panelRef}
          className="w-80 flex flex-col h-full"
          style={{ width: "var(--right-sidebar-panel-width)" }}
        >
          {/* Panel header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
            <h2 className="font-semibold text-sm">{panelTitle}</h2>
            <div className="flex items-center gap-1">
              {/* Pin toggle */}
              <TooltipIconButton
                label={rightSidebarPinned ? "Désépingler" : "Épingler ouvert"}
                tooltipSide="left"
                className="h-8 w-8"
                onClick={handlePinToggle}
              >
                <Pin
                  className={cn(
                    "h-4 w-4",
                    rightSidebarPinned && "fill-primary text-primary",
                  )}
                />
              </TooltipIconButton>
              {!rightSidebarPinned && (
                <TooltipIconButton
                  label="Fermer le panneau"
                  tooltipSide="left"
                  className="h-8 w-8"
                  onClick={() => setRightSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </TooltipIconButton>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            {/* Widget mode */}
            {panelMode === "widget" && (
              <div className="p-0">
                {activeRightWidget === "chat" && <ChatWidget />}
                {activeRightWidget === "calendar" && <CalendarWidget />}
                {activeRightWidget === "tasks" && <TasksWidget />}
                {activeRightWidget === "notes" && (
                  <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                    <StickyNote className="h-4 w-4" /> Notes Widget
                    Chargement...
                  </div>
                )}
              </div>
            )}

            {/* App launcher mode — scrollable */}
            {panelMode === "apps" && (
              <div className="p-3 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                {/* Drag hint */}
                <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[10px] text-muted-foreground">
                  <Pin className="h-3 w-3 shrink-0" />
                  Glisser une app pour l&apos;épingler dans la barre
                </div>

                {filteredApps ? (
                  filteredApps.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Aucune application
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 gap-1">
                      {filteredApps.map((app, i) => (
                        <div
                          key={`${app.href}-${i}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, app)}
                          onClick={() => router.push(app.href)}
                          className="flex cursor-pointer flex-col items-center gap-1 rounded-lg p-1.5 text-center transition-colors hover:bg-muted active:scale-95"
                          title={app.label}
                        >
                          <div
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg bg-muted",
                              app.color,
                            )}
                          >
                            <DynIcon name={app.icon} className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-[9px] leading-tight text-muted-foreground line-clamp-1 w-full text-center">
                            {app.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  APP_CATEGORIES.map((cat) => {
                    const apps = appRegistry.filter((a) => a.category === cat);
                    return (
                      <div key={cat} className="mb-3">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {cat}
                        </p>
                        <div className="grid grid-cols-4 gap-1">
                          {apps.map((app, i) => (
                            <div
                              key={`${app.href}-${i}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, app)}
                              onClick={() => router.push(app.href)}
                              className="flex cursor-pointer flex-col items-center gap-1 rounded-lg p-1.5 text-center transition-colors hover:bg-muted active:scale-95"
                              title={app.label}
                            >
                              <div
                                className={cn(
                                  "flex h-7 w-7 items-center justify-center rounded-lg bg-muted",
                                  app.color,
                                )}
                              >
                                <DynIcon
                                  name={app.icon}
                                  className="h-3.5 w-3.5"
                                />
                              </div>
                              <span className="text-[9px] leading-tight text-muted-foreground line-clamp-1 w-full text-center">
                                {app.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Icon Bar (always visible, fixed on far right) */}
      <aside
        ref={iconBarRef}
        aria-label="Barre d'outils latérale"
        className="hidden md:flex fixed top-0 right-0 bottom-0 w-16 bg-background border-l border-border z-40 flex-col items-center py-4 gap-1"
        style={{ width: "var(--right-sidebar-icon-width)" }}
      >
        <TooltipProvider delayDuration={0}>
          {displayedIcons.map((item) => {
            const isActive =
              isOpen && activeRightWidget === item.id && panelMode === "widget";
            return (
              <TooltipIconButton
                key={item.id + item.label}
                label={item.label}
                tooltipSide="left"
                className={cn(
                  "h-10 w-10 transition-colors",
                  isActive && "bg-accent text-accent-foreground",
                )}
                onClick={() => toggleWidget(item.id)}
              >
                <item.icon className="h-5 w-5" />
              </TooltipIconButton>
            );
          })}

          <div className="my-1 w-8 border-t border-border" />

          {/* App launcher toggle */}
          <TooltipIconButton
            label="All Apps"
            tooltipSide="left"
            className={cn(
              "h-10 w-10 transition-colors",
              isOpen &&
                panelMode === "apps" &&
                "bg-accent text-accent-foreground",
            )}
            onClick={openApps}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </TooltipIconButton>

          {/* Expand/collapse toggle */}
          <div className="mt-auto flex flex-col items-center gap-2">
            {/* Radial menu FAB — centered above pin */}
            <div
              id="radial-menu-anchor"
              className="flex items-center justify-center"
            />

            {/* Pin indicator */}
            {rightSidebarPinned && (
              <TooltipIconButton
                label="Désépingler"
                tooltipSide="left"
                className="h-8 w-8 text-primary"
                onClick={handlePinToggle}
              >
                <Pin className="h-4 w-4 fill-primary" />
              </TooltipIconButton>
            )}
            <TooltipIconButton
              label={isOpen ? "Hide Panel" : "Show Panel"}
              tooltipSide="left"
              className="h-10 w-10 text-muted-foreground"
              onClick={() => setRightSidebarOpen(!isOpen)}
            >
              <ChevronRight
                className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
              />
            </TooltipIconButton>
          </div>
        </TooltipProvider>
      </aside>
    </>
  );
}
