"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUIStore, RightWidgetType } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot, CalendarDays, CheckSquare, StickyNote,
  X, ChevronRight, Pin, Search,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { ChatWidget } from "@/components/chat/chat-widget";
import { CalendarWidget } from "@/components/calendar/calendar-widget";
import { TasksWidget } from "@/components/tasks/tasks-widget";
import { APP_REGISTRY, APP_CATEGORIES } from "@/lib/app-registry";

function DynIcon({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (LucideIcons as any)[name] as React.ComponentType<{ className?: string }> | undefined;
  if (!Icon) return <LucideIcons.Grid className={className} />;
  return <Icon className={className} />;
}

const widgetItems = [
  { id: "chat"     as RightWidgetType, icon: Bot,          label: "AI Assistant" },
  { id: "calendar" as RightWidgetType, icon: CalendarDays, label: "Calendar" },
  { id: "tasks"    as RightWidgetType, icon: CheckSquare,  label: "Tasks" },
  { id: "notes"    as RightWidgetType, icon: StickyNote,   label: "Keep Notes" },
] as const;

export function RightSidebar() {
  const router = useRouter();
  const { rightSidebarOpen, activeRightWidget, setRightSidebarOpen, setActiveRightWidget } = useUIStore();
  const [mounted, setMounted] = useState(false);
  const [panelMode, setPanelMode] = useState<"widget" | "apps">("widget");
  const [appSearch, setAppSearch] = useState("");

  useEffect(() => { setMounted(true); }, []);

  // Force panel closed on first mount to reset any stale localStorage state
  useEffect(() => {
    setRightSidebarOpen(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isOpen = mounted ? rightSidebarOpen : false;

  const toggleWidget = (widget: RightWidgetType) => {
    if (isOpen && activeRightWidget === widget && panelMode === "widget") {
      setRightSidebarOpen(false);
    } else {
      setPanelMode("widget");
      setActiveRightWidget(widget);
    }
  };

  const openApps = () => {
    if (isOpen && panelMode === "apps") {
      setRightSidebarOpen(false);
    } else {
      setPanelMode("apps");
      setRightSidebarOpen(true);
    }
  };

  const panelTitle =
    panelMode === "apps"
      ? "Applications"
      : (widgetItems.find((i) => i.id === activeRightWidget)?.label ?? "Panel");

  const filteredApps = useMemo(() => {
    if (!appSearch.trim()) return null;
    const q = appSearch.toLowerCase();
    return APP_REGISTRY.filter(
      (a) => a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [appSearch]);

  const handleDragStart = (e: React.DragEvent, app: typeof APP_REGISTRY[0]) => {
    e.dataTransfer.setData("application/json", JSON.stringify({
      href: app.href, icon: app.icon, label: app.label, color: app.color,
    }));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <>
      {/* Expanded Panel */}
      <div
        className={cn(
          "hidden md:flex fixed top-0 right-16 bottom-0 w-80 bg-background border-l border-border",
          "transition-all duration-300 ease-in-out z-30 flex-col shadow-xl",
          isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
        )}
      >
        {/* Panel header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm">{panelTitle}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRightSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {/* Widget mode */}
          {panelMode === "widget" && (
            <div className="p-0">
              {activeRightWidget === "chat"     && <ChatWidget />}
              {activeRightWidget === "calendar" && <CalendarWidget />}
              {activeRightWidget === "tasks"    && <TasksWidget />}
              {activeRightWidget === "notes"    && (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <StickyNote className="h-4 w-4" /> Notes Widget Loading...
                </div>
              )}
            </div>
          )}

          {/* App launcher mode */}
          {panelMode === "apps" && (
            <div className="p-3 space-y-1">
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
                  <p className="py-6 text-center text-xs text-muted-foreground">Aucune application</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1">
                    {filteredApps.map((app) => (
                      <div
                        key={app.href}
                        draggable
                        onDragStart={(e) => handleDragStart(e, app)}
                        onClick={() => router.push(app.href)}
                        className="flex cursor-pointer flex-col items-center gap-1 rounded-lg p-1.5 text-center transition-colors hover:bg-muted active:scale-95"
                        title={app.label}
                      >
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg bg-muted", app.color)}>
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
                  const apps = APP_REGISTRY.filter((a) => a.category === cat);
                  return (
                    <div key={cat} className="mb-3">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {cat}
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {apps.map((app) => (
                          <div
                            key={app.href}
                            draggable
                            onDragStart={(e) => handleDragStart(e, app)}
                            onClick={() => router.push(app.href)}
                            className="flex cursor-pointer flex-col items-center gap-1 rounded-lg p-1.5 text-center transition-colors hover:bg-muted active:scale-95"
                            title={app.label}
                          >
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg bg-muted", app.color)}>
                              <DynIcon name={app.icon} className="h-3.5 w-3.5" />
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

      {/* Icon Bar (always visible, fixed on far right) */}
      <div className="hidden md:flex fixed top-0 right-0 bottom-0 w-16 bg-background border-l border-border z-40 flex-col items-center py-4 gap-1">
        <TooltipProvider delayDuration={0}>
          {widgetItems.map((item) => {
            const isActive = isOpen && activeRightWidget === item.id && panelMode === "widget";
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className={cn("h-10 w-10 transition-colors", isActive && "bg-accent text-accent-foreground")}
                    onClick={() => toggleWidget(item.id)}
                  >
                    <item.icon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left"><p>{item.label}</p></TooltipContent>
              </Tooltip>
            );
          })}

          <div className="my-1 w-8 border-t border-border" />

          {/* App launcher toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" size="icon"
                className={cn("h-10 w-10 transition-colors", isOpen && panelMode === "apps" && "bg-accent text-accent-foreground")}
                onClick={openApps}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3"  y="3"  width="7" height="7" rx="1" />
                  <rect x="14" y="3"  width="7" height="7" rx="1" />
                  <rect x="3"  y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left"><p>All Apps</p></TooltipContent>
          </Tooltip>

          {/* Expand/collapse toggle */}
          <div className="mt-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground"
                  onClick={() => setRightSidebarOpen(!isOpen)}>
                  <ChevronRight className={cn("h-5 w-5 transition-transform duration-200", isOpen && "rotate-180")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left"><p>{isOpen ? "Hide Panel" : "Show Panel"}</p></TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </>
  );
}
