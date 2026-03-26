"use client";

import { useState, useEffect } from "react";
import { useUIStore, RightWidgetType } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  StickyNote,
  Info,
  X,
  ChevronRight
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { ChatWidget } from "@/components/chat/chat-widget";
import { CalendarWidget } from "@/components/calendar/calendar-widget";
import { TasksWidget } from "@/components/tasks/tasks-widget";

export function RightSidebar() {
  const { rightSidebarOpen, activeRightWidget, setRightSidebarOpen, setActiveRightWidget } = useUIStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleWidget = (widget: RightWidgetType) => {
    if (rightSidebarOpen && activeRightWidget === widget) {
      setRightSidebarOpen(false);
    } else {
      setActiveRightWidget(widget);
    }
  };

  const navItems = [
    { id: "chat", icon: Bot, label: "AI Assistant" },
    { id: "calendar", icon: CalendarDays, label: "Calendar" },
    { id: "tasks", icon: CheckSquare, label: "Tasks" },
    { id: "notes", icon: StickyNote, label: "Keep Notes" },
    { id: "details", icon: Info, label: "Document Details" },
  ] as const;

  const isRightSidebarOpen = mounted ? rightSidebarOpen : false;

  return (
    <>
      {/* Expanded Panel */}
      <div
        className={cn(
          "hidden md:flex fixed top-0 right-16 bottom-0 w-80 bg-background border-l border-border transition-transform duration-300 ease-in-out z-30 flex-col shadow-xl",
          isRightSidebarOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          <h2 className="font-semibold text-sm capitalize">
            {navItems.find(i => i.id === activeRightWidget)?.label || "Productivity Hub"}
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRightSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-0">
            {/* Widget Content placeholder */}
            {activeRightWidget === 'chat' && <ChatWidget />}
            {activeRightWidget === 'calendar' && <CalendarWidget />}
            {activeRightWidget === 'tasks' && <TasksWidget />}
            {activeRightWidget === 'notes' && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <StickyNote className="h-4 w-4" /> Notes Widget Loading...
              </div>
            )}
            {activeRightWidget === 'details' && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" /> Document Info Loading...
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Icon Bar (Always visible on the far right) */}
      <div className="hidden md:flex fixed top-0 right-0 bottom-0 w-16 bg-background border-l border-border z-40 flex-col items-center py-4 gap-4">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const isActive = isRightSidebarOpen && activeRightWidget === item.id;
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-10 w-10 transition-colors",
                      isActive && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => toggleWidget(item.id)}
                  >
                    <item.icon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>

        <div className="mt-auto">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground"
                  onClick={() => setRightSidebarOpen(!isRightSidebarOpen)}
                >
                  <ChevronRight className={cn("h-5 w-5 transition-transform", isRightSidebarOpen && "rotate-180")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{isRightSidebarOpen ? 'Hide Panel' : 'Show Panel'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}
