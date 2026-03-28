"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIStore, RightWidgetType } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  StickyNote,
  X,
  ChevronRight,
  // Productivité
  FileText,
  Sheet,
  Presentation,
  Palette,
  BookOpen,
  ClipboardList,
  // Communication
  Mail,
  MessageSquare,
  Video,
  Users2,
  // Organisation
  Calendar,
  ListTodo,
  KanbanSquare,
  Package,
  ContactRound,
  // Business
  TrendingUp,
  CreditCard,
  Calculator,
  BarChart3,
  // Infrastructure
  HardDrive,
  Container,
  Shield,
  Activity,
  // Administration
  Users,
  Settings,
  Archive,
  Clock,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { ChatWidget } from "@/components/chat/chat-widget";
import { CalendarWidget } from "@/components/calendar/calendar-widget";
import { TasksWidget } from "@/components/tasks/tasks-widget";

// ── App launcher categories ──
const appCategories = [
  {
    label: "Productivité",
    apps: [
      { icon: FileText,       label: "Docs",    href: "/docs" },
      { icon: Sheet,          label: "Sheets",  href: "/sheets" },
      { icon: Presentation,   label: "Slides",  href: "/slides" },
      { icon: Palette,        label: "Design",  href: "/design" },
      { icon: StickyNote,     label: "Keep",    href: "/keep" },
      { icon: ClipboardList,  label: "Forms",   href: "/forms" },
    ],
  },
  {
    label: "Communication",
    apps: [
      { icon: Mail,         label: "Mail",    href: "/mail" },
      { icon: MessageSquare,label: "Chat",    href: "/chat" },
      { icon: Video,        label: "Meet",    href: "/meet" },
      { icon: Users2,       label: "Social",  href: "/social" },
    ],
  },
  {
    label: "Organisation",
    apps: [
      { icon: Calendar,       label: "Calendar",  href: "/cal" },
      { icon: ListTodo,       label: "Tasks",     href: "/tasks" },
      { icon: KanbanSquare,   label: "Projects",  href: "/projects" },
      { icon: Package,        label: "Resources", href: "/resources" },
      { icon: ContactRound,   label: "Contacts",  href: "/contacts" },
    ],
  },
  {
    label: "Business",
    apps: [
      { icon: TrendingUp, label: "CRM",        href: "/crm" },
      { icon: CreditCard, label: "Billing",    href: "/billing" },
      { icon: Calculator, label: "Accounting", href: "/accounting" },
      { icon: BarChart3,  label: "Analytics",  href: "/analytics" },
    ],
  },
  {
    label: "Infrastructure",
    apps: [
      { icon: HardDrive,  label: "Drive",       href: "/storage" },
      { icon: Container,  label: "Containers",  href: "/containers" },
      { icon: Shield,     label: "VPN",         href: "/vpn" },
      { icon: Activity,   label: "Monitoring",  href: "/monitoring" },
    ],
  },
  {
    label: "Administration",
    apps: [
      { icon: Users,    label: "Users",     href: "/admin/users" },
      { icon: Settings, label: "Settings",  href: "/settings" },
      { icon: Archive,  label: "Backups",   href: "/backups" },
      { icon: Clock,    label: "Scheduler", href: "/scheduler" },
    ],
  },
] as const;

// Widget toggle icons shown at the top of the icon bar
const widgetItems = [
  { id: "chat" as RightWidgetType,     icon: Bot,         label: "AI Assistant" },
  { id: "calendar" as RightWidgetType, icon: CalendarDays,label: "Calendar" },
  { id: "tasks" as RightWidgetType,    icon: CheckSquare, label: "Tasks" },
  { id: "notes" as RightWidgetType,    icon: StickyNote,  label: "Keep Notes" },
] as const;

export function RightSidebar() {
  const router = useRouter();
  const { rightSidebarOpen, activeRightWidget, setRightSidebarOpen, setActiveRightWidget } = useUIStore();
  const [mounted, setMounted] = useState(false);
  // Controls whether the panel shows widgets or the app launcher
  const [panelMode, setPanelMode] = useState<"widget" | "apps">("apps");

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
    <>
      {/* ── Expanded Panel (slides in from right, sits to the left of the icon bar) ── */}
      <div
        className={cn(
          "hidden md:flex fixed top-0 right-16 bottom-0 w-80 bg-background border-l border-border",
          "transition-transform duration-300 ease-in-out z-30 flex-col shadow-xl",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm">{panelTitle}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setRightSidebarOpen(false)}
          >
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
            <div className="p-4 space-y-5">
              {appCategories.map((cat) => (
                <div key={cat.label}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.label}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {cat.apps.map((app) => (
                      <button
                        key={app.href}
                        onClick={() => { router.push(app.href); }}
                        className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors hover:bg-muted"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                          <app.icon className="h-4 w-4 text-foreground/70" />
                        </div>
                        <span className="text-[10px] leading-tight text-muted-foreground">
                          {app.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Icon Bar (always visible, fixed on far right) ── */}
      <div className="hidden md:flex fixed top-0 right-0 bottom-0 w-16 bg-background border-l border-border z-40 flex-col items-center py-4 gap-1">
        <TooltipProvider delayDuration={0}>

          {/* Widget toggle icons */}
          {widgetItems.map((item) => {
            const isActive = isOpen && activeRightWidget === item.id && panelMode === "widget";
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

          {/* Divider */}
          <div className="my-1 w-8 border-t border-border" />

          {/* App launcher toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 transition-colors",
                  isOpen && panelMode === "apps" && "bg-accent text-accent-foreground"
                )}
                onClick={openApps}
              >
                {/* 3x3 grid icon */}
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
                  <rect x="3"  y="3"  width="7" height="7" rx="1" />
                  <rect x="14" y="3"  width="7" height="7" rx="1" />
                  <rect x="3"  y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>All Apps</p>
            </TooltipContent>
          </Tooltip>

          {/* Expand/collapse toggle at bottom */}
          <div className="mt-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground"
                  onClick={() => setRightSidebarOpen(!isOpen)}
                >
                  <ChevronRight
                    className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{isOpen ? "Hide Panel" : "Show Panel"}</p>
              </TooltipContent>
            </Tooltip>
          </div>

        </TooltipProvider>
      </div>
    </>
  );
}
