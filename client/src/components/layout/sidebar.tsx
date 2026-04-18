"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { AppLogo } from "@/components/layout/app-logo";
import { cn } from "@/lib/utils";
import {
  useUIStore,
  useAuthStore,
  useLabelsStore,
  usePinnedAppsStore,
  type AppPin,
  type PinFolder,
} from "@/lib/store";
import type { PortalMode } from "@/components/layout/app-layout";
import { Pin } from "lucide-react";
import { useSidebarBadges } from "@/hooks/use-sidebar-badges";
import { useTeamStore } from "@/stores/team-store";
import {
  LayoutDashboard,
  Mail,
  CheckSquare,
  HardDrive,
  Calendar,
  Container,
  Network,
  Settings,
  Users,
  Shield,
  Clock,
  Activity,
  Mic,
  Store,
  Archive,
  Plus,
  Tag,
  Brain,
  Upload,
  MessageSquare,
  Route,
  X,
  Star,
  HelpCircle,
  GripVertical,
  Grid,
  PenLine,
  History,
  Building2,
  MapPin,
  Server,
  ChevronDown,
  FileSignature,
  Webhook,
  ClipboardCheck,
  PanelLeftOpen,
  PanelLeftClose,
  ChevronRight,
  Folder,
  FolderOpen,
} from "lucide-react";
// AQ-PERF: lucide-react/dynamic lazy-loads each icon SVG as a separate
// chunk on demand.  Used here for the pinned-app rendering (arbitrary
// icon names from user data) — avoids pulling the full ~1.5k-icon
// barrel into the app-shell first-load chunk.
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function DynIcon({ name, className }: { name: string; className?: string }) {
  // `DynamicIcon` from lucide-react/dynamic accepts a kebab-case icon
  // name ("layout-dashboard") and lazy-loads just that icon's SVG.
  // We keep a <Grid /> fallback while the chunk is fetched or when
  // the provided name is not a valid lucide icon.
  const kebab = name
    .replace(/([A-Z])/g, "-$1")
    .replace(/^-/, "")
    .toLowerCase();
  return (
    <DynamicIcon
      name={kebab as IconName}
      className={className}
      fallback={() => <Grid className={className} />}
    />
  );
}

const quickActions = [
  {
    icon: Container,
    label: "Nouveau Container",
    href: "/containers",
    color: "text-crm",
  },
  {
    icon: Route,
    label: "Ajouter Route",
    href: "/routes",
    color: "text-primary",
  },
  {
    icon: Upload,
    label: "Upload Fichiers",
    href: "/storage",
    color: "text-inventory",
  },
  {
    icon: MessageSquare,
    label: "Chat IA",
    href: "/ai",
    color: "text-ai-purple",
  },
  {
    icon: Archive,
    label: "Nouveau Backup",
    href: "/backups",
    color: "text-muted-foreground",
  },
];

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  badgeKey: "mail" | "tasks" | "storage" | null;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

// Top-level items always visible (no group header)
const topNavItems: NavItem[] = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Tableau de bord",
    color: "",
    badgeKey: null,
  },
  {
    href: "/all-apps",
    icon: Grid,
    label: "Applications",
    color: "text-indigo-500",
    badgeKey: null,
  },
];

// Grouped sections — collapsed by default except Workspace
const navSections: NavSection[] = [
  {
    id: "workspace",
    label: "Espace de travail",
    items: [
      {
        href: "/mail",
        icon: Mail,
        label: "Mail",
        color: "text-blue-500",
        badgeKey: "mail" as const,
      },
      {
        href: "/cal",
        icon: Calendar,
        label: "Calendrier",
        color: "text-blue-400",
        badgeKey: null,
      },
      {
        href: "/storage",
        icon: HardDrive,
        label: "Drive",
        color: "text-muted-foreground",
        badgeKey: "storage" as const,
      },
      {
        href: "/tasks",
        icon: CheckSquare,
        label: "Tâches",
        color: "text-green-500",
        badgeKey: "tasks" as const,
      },
      {
        href: "/whiteboard",
        icon: PenLine,
        label: "Tableau blanc",
        color: "text-violet-500",
        badgeKey: null,
      },
    ],
  },
  {
    id: "productivity",
    label: "Productivité",
    items: [
      {
        href: "/vault",
        icon: Shield,
        label: "Coffre-fort",
        color: "text-emerald-500",
        badgeKey: null,
      },
      {
        href: "/signatures",
        icon: FileSignature,
        label: "Signatures",
        color: "text-indigo-500",
        badgeKey: null,
      },
      {
        href: "/admin/ai/lightrag",
        icon: Brain,
        label: "LightRAG",
        color: "text-violet-500",
        badgeKey: null,
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    items: [
      {
        href: "/admin/org-structure",
        icon: Building2,
        label: "Structure org",
        color: "text-purple-500",
        badgeKey: null,
      },
      {
        href: "/admin/persons",
        icon: Users,
        label: "Personnes",
        color: "text-emerald-500",
        badgeKey: null,
      },
      {
        href: "/admin/sites",
        icon: MapPin,
        label: "Sites",
        color: "text-cyan-500",
        badgeKey: null,
      },
      {
        href: "/admin/mail-server",
        icon: Server,
        label: "Serveur Mail",
        color: "text-orange-500",
        badgeKey: null,
      },
      {
        href: "/admin/active-directory",
        icon: Network,
        label: "Active Directory",
        color: "text-sky-500",
        badgeKey: null,
      },
      {
        href: "/admin/drive-audit",
        icon: History,
        label: "Audit Drive",
        color: "text-amber-500",
        badgeKey: null,
      },
      {
        href: "/admin/webhooks",
        icon: Webhook,
        label: "Webhooks",
        color: "text-orange-500",
        badgeKey: null,
      },
      {
        href: "/compliance",
        icon: ClipboardCheck,
        label: "Conformité",
        color: "text-blue-500",
        badgeKey: null,
      },
    ],
  },
];

// localStorage key for persisted section open state
const SECTION_STATE_KEY = "sidebar-sections-open";

const labelColors = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
  "#1a73e8",
];

// Nav item labels visible per portal context
const PORTAL_CLIENT_ITEMS = new Set([
  "/dashboard",
  "/all-apps",
  "/mail",
  "/storage",
  "/tasks",
]);

const PORTAL_CLIENT_SECTION_ITEMS = new Set(["/mail", "/storage", "/tasks"]);

// For client portal: Dashboard + subset of workspace
const CLIENT_PORTAL_TOP = topNavItems; // Dashboard + Applications always shown

// For supplier portal: Dashboard + similar subset
const PORTAL_SUPPLIER_ITEMS = new Set([
  "/dashboard",
  "/all-apps",
  "/mail",
  "/storage",
  "/tasks",
]);

interface SidebarProps {
  portalMode?: PortalMode;
}

export function Sidebar({ portalMode }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeContext = useAuthStore((s) => s.activeContext);
  const hasReports = useTeamStore((s) => s.hasReports);
  const {
    sidebarCollapsed,
    sidebarPinned,
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarPinned,
  } = useUIStore();

  // Resolve effective portal mode: explicit prop overrides store context
  const effectivePortalMode: PortalMode =
    portalMode ??
    (activeContext?.context_type === "client"
      ? "client"
      : activeContext?.context_type === "supplier"
        ? "supplier"
        : null);

  // Filter nav sections based on portal mode
  const visibleNavSections = effectivePortalMode
    ? navSections
        .filter((section) => {
          if (effectivePortalMode === "client") {
            // Clients see only workspace section items that are relevant
            return section.id === "workspace";
          }
          if (effectivePortalMode === "supplier") {
            return section.id === "workspace";
          }
          return true;
        })
        .map((section) => {
          if (effectivePortalMode === "client") {
            return {
              ...section,
              items: section.items.filter((item) =>
                PORTAL_CLIENT_SECTION_ITEMS.has(item.href),
              ),
            };
          }
          if (effectivePortalMode === "supplier") {
            return {
              ...section,
              items: section.items.filter((item) =>
                PORTAL_SUPPLIER_ITEMS.has(item.href),
              ),
            };
          }
          return section;
        })
    : navSections;

  // Conditionally inject "Mon équipe" into the workspace section for managers
  const visibleNavSectionsWithTeam = visibleNavSections.map((section) => {
    if (section.id !== "workspace") return section;
    const myTeamItem: NavItem = {
      href: "/my-team",
      icon: Users,
      label: "Mon équipe",
      color: "text-blue-500",
      badgeKey: null,
    };
    const alreadyPresent = section.items.some((i) => i.href === "/my-team");
    if (hasReports && !alreadyPresent) {
      return { ...section, items: [...section.items, myTeamItem] };
    }
    return section;
  });

  const { labels, addLabel, removeLabel } = useLabelsStore();
  const { data: badges } = useSidebarBadges();
  const {
    pinnedApps,
    pinApp,
    unpinApp,
    reorderPinnedApps,
    folders,
    createFolder,
    deleteFolder,
    toggleFolder,
    moveToFolder,
    renameFolder,
  } = usePinnedAppsStore();
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Hover-to-expand: only when not pinned
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const isExpanded = !sidebarCollapsed || hoverExpanded;

  const handleMouseEnter = () => {
    if (!sidebarPinned && sidebarCollapsed) {
      setHoverExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (!sidebarPinned) {
      setHoverExpanded(false);
    }
  };

  const [nouveauOpen, setNouveauOpen] = useState(false);
  const [addLabelOpen, setAddLabelOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");

  // Section collapse state — persisted to localStorage
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => {
      if (typeof window === "undefined") return { workspace: true };
      try {
        const saved = localStorage.getItem(SECTION_STATE_KEY);
        return saved ? JSON.parse(saved) : { workspace: true };
      } catch {
        return { workspace: true };
      }
    },
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Drop zone state
  const [isDragOver, setIsDragOver] = useState(false);
  // Pinned reorder drag state
  const dragPinIndex = useRef<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    href: string;
    x: number;
    y: number;
  } | null>(null);

  // Dismiss context menu on click elsewhere
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  const handleAddLabel = () => {
    if (!newLabelName.trim()) return;
    addLabel(newLabelName.trim(), newLabelColor);
    setNewLabelName("");
    setNewLabelColor("#3b82f6");
    setAddLabelOpen(false);
  };

  // ── Drop zone handlers (sidebar accepts apps from dashboard/right sidebar) ──
  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/json")) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the sidebar entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(
        e.dataTransfer.getData("application/json"),
      ) as AppPin;
      if (data?.href && data?.label) {
        pinApp(data);
      }
    } catch {
      // ignore malformed data
    }
  };

  // ── Pinned items reorder drag ──
  const handlePinDragStart = (e: React.DragEvent, index: number) => {
    dragPinIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
    // Set empty data to distinguish from app-card drags
    e.dataTransfer.setData("text/pin-reorder", String(index));
    e.stopPropagation();
  };

  const handlePinDragOver = (e: React.DragEvent, index: number) => {
    if (dragPinIndex.current === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handlePinDrop = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    const from = dragPinIndex.current;
    if (from === null || from === index) return;
    const reordered = [...pinnedApps];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(index, 0, moved);
    reorderPinnedApps(reordered);
    dragPinIndex.current = null;
  };

  const mobileOpen = !sidebarCollapsed;

  const renderNavLink = (item: {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    badgeKey: string | null;
  }) => {
    const safeHref = item.href || "#";
    const isActive = pathname.startsWith(
      safeHref !== "#" ? safeHref : "/___invalid___",
    );
    const Icon = item.icon;
    const badgeValue =
      item.badgeKey && badges
        ? (badges as Record<string, number>)[item.badgeKey]
        : undefined;

    const linkContent = (
      <Link
        href={safeHref}
        title={item.label}
        data-active={isActive}
        onClick={(e) => {
          if (isActive && safeHref !== "/") {
            const event = new CustomEvent("reset-navigation", {
              detail: { path: safeHref },
            });
            window.dispatchEvent(event);
          }
        }}
        className={cn(
          "sidebar-indicator flex items-center gap-4 py-2.5 min-h-[44px] text-sm font-medium transition-all duration-150",
          !isExpanded
            ? "justify-center rounded-lg mx-2 px-2"
            : "rounded-r-full px-6",
          isActive
            ? "bg-accent text-accent-foreground font-semibold"
            : "text-sidebar-foreground hover:bg-muted active:scale-[0.98]",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0",
            isActive
              ? "text-accent-foreground"
              : item.color || "text-muted-foreground",
          )}
        />
        {isExpanded && (
          <>
            <span className="flex-1">{item.label}</span>
            {badgeValue !== undefined && badgeValue > 0 && (
              <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {badgeValue > 99 ? "99+" : badgeValue}
              </span>
            )}
          </>
        )}
      </Link>
    );

    if (!isExpanded) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right">
            {item.label}
            {badgeValue !== undefined && badgeValue > 0 && ` (${badgeValue})`}
          </TooltipContent>
        </Tooltip>
      );
    }
    return <div key={item.href}>{linkContent}</div>;
  };

  const renderPinnedItem = (app: AppPin, index: number) => {
    const safeHref = app.href || "#";
    const isActive = pathname.startsWith(
      safeHref !== "#" ? safeHref : "/___invalid___",
    );
    const linkContent = (
      <div
        key={app.href || index}
        className="group relative flex items-center"
        draggable
        onDragStart={(e) => handlePinDragStart(e, index)}
        onDragOver={(e) => handlePinDragOver(e, index)}
        onDrop={(e) => handlePinDrop(e, index)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ href: safeHref, x: e.clientX, y: e.clientY });
        }}
      >
        {isExpanded && (
          <span className="absolute left-1 z-10 cursor-grab text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100">
            <GripVertical className="h-3 w-3" />
          </span>
        )}
        <Link
          href={safeHref}
          title={app.label}
          data-active={isActive}
          onClick={(e) => {
            if (isActive && safeHref !== "/") {
              const event = new CustomEvent("reset-navigation", {
                detail: { path: safeHref },
              });
              window.dispatchEvent(event);
            }
          }}
          className={cn(
            "sidebar-indicator flex flex-1 items-center gap-4 py-2.5 min-h-[44px] text-sm font-medium transition-all duration-150",
            !isExpanded
              ? "justify-center rounded-lg mx-2 px-2"
              : "rounded-r-full px-6 pl-5",
            isActive
              ? "bg-accent text-accent-foreground font-semibold"
              : "text-sidebar-foreground hover:bg-muted active:scale-[0.98]",
          )}
        >
          <DynIcon
            name={app.icon}
            className={cn(
              "h-5 w-5 shrink-0",
              isActive
                ? "text-accent-foreground"
                : app.color || "text-muted-foreground",
            )}
          />
          {isExpanded && <span className="flex-1 truncate">{app.label}</span>}
        </Link>
        {isExpanded && (
          <button
            onClick={() => unpinApp(app.href)}
            className="absolute right-2 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            title="Désépingler"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );

    if (!isExpanded) {
      return (
        <Tooltip key={app.href}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right">{app.label}</TooltipContent>
        </Tooltip>
      );
    }
    return <div key={app.href}>{linkContent}</div>;
  };

  return (
    <TooltipProvider delayDuration={0}>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drag-and-drop drop target on nav; no keyboard equivalent for file drag */}
      <nav
        aria-label="Navigation principale"
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 flex h-full flex-col bg-sidebar py-4 transition-all duration-200 border-r",
          isDragOver
            ? "border-primary/60 shadow-[inset_0_0_0_2px_hsl(var(--primary)/0.4)]"
            : "border-sidebar-border",
          !isExpanded ? "w-16" : "w-64 pr-4",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Brand Logo */}
        <div
          className={cn(
            "mb-3 flex items-center",
            isExpanded ? "px-6 gap-3" : "justify-center px-2",
          )}
        >
          <Link href="/dashboard">
            <AppLogo size={isExpanded ? "md" : "sm"} showText={isExpanded} />
          </Link>
        </div>

        {/* Header row: collapse toggle + pin */}
        <div
          className={cn(
            "mb-2 flex items-center",
            isExpanded
              ? "px-4 justify-between"
              : "px-2 justify-center flex-col gap-1",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={sidebarCollapsed ? "Développer" : "Réduire"}
                title={sidebarCollapsed ? "Développer" : "Réduire"}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {sidebarCollapsed ? "Développer" : "Réduire"}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarCollapsed ? "Développer" : "Réduire"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSidebarPinned(!sidebarPinned)}
                className={cn(
                  "rounded-lg p-1.5 transition-colors hover:bg-muted",
                  sidebarPinned
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label={
                  sidebarPinned ? "Désépingler la barre" : "Épingler la barre"
                }
                title={
                  sidebarPinned ? "Désépingler la barre" : "Épingler la barre"
                }
              >
                <Pin
                  className={cn("h-4 w-4", sidebarPinned && "fill-primary")}
                />
                <span className="sr-only">
                  {sidebarPinned ? "Désépingler" : "Épingler"}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarPinned ? "Désépingler" : "Épingler"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Nouveau Button */}
        <div className={cn("mb-4", !isExpanded ? "px-2" : "px-4")}>
          {!isExpanded ? (
            <Popover open={nouveauOpen} onOpenChange={setNouveauOpen}>
              <PopoverTrigger asChild>
                <button
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-card google-shadow google-shadow-hover transition-all"
                  title="Nouveau"
                >
                  <Plus className="h-6 w-6 text-primary" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-52 p-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      router.push(action.href);
                      setNouveauOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <action.icon className={cn("h-4 w-4", action.color)} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          ) : (
            <Popover open={nouveauOpen} onOpenChange={setNouveauOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-3 rounded-2xl bg-card px-6 py-4 google-shadow google-shadow-hover transition-all text-sm font-medium text-foreground/80">
                  <Plus className="h-7 w-7 text-primary" />
                  Nouveau
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-56 p-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      router.push(action.href);
                      setNouveauOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                  >
                    <action.icon className={cn("h-4 w-4", action.color)} />
                    <span>{action.label}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {/* Top-level items (always visible) */}
          {topNavItems.map((item) => renderNavLink(item))}

          {/* Grouped collapsible sections */}
          {visibleNavSectionsWithTeam.map((section) => {
            const isOpen = !!openSections[section.id];
            const hasActive = section.items.some((item) =>
              pathname.startsWith(item.href),
            );

            // In collapsed sidebar mode just render items without headers
            if (!isExpanded) {
              return (
                <div key={section.id}>
                  {section.items.map((item) => renderNavLink(item))}
                </div>
              );
            }

            return (
              <Collapsible
                key={section.id}
                open={isOpen}
                onOpenChange={() => toggleSection(section.id)}
                className="mx-2 mt-1"
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                      hasActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <span className="flex-1 text-left">{section.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 shrink-0 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-0.5 space-y-0.5">
                    {section.items.map((item) => renderNavLink(item))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Dynamic Drop Zone Hint for Pinned items */}
          {isDragOver && isExpanded && (
            <div className="mx-4 my-3 pointer-events-none flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-4 text-center text-sm font-medium text-primary shadow-sm animate-in zoom-in-95 duration-200">
              <div className="p-3 bg-primary/10 rounded-full animate-pulse">
                <Pin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">Déposer ici</span>
                <span className="text-xs text-muted-foreground font-normal">
                  pour épingler au menu
                </span>
              </div>
            </div>
          )}

          {/* Pinned section with folders */}
          {(pinnedApps.length > 0 || folders.length > 0) && (
            <>
              {isExpanded && (
                <div className="mx-4 mt-3 mb-1 border-t border-sidebar-border pt-3">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Épinglés
                    </p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Nouveau dossier"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        className="w-48 p-2 space-y-2"
                      >
                        <p className="text-xs font-semibold">Nouveau dossier</p>
                        <Input
                          placeholder="Nom du dossier"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newFolderName.trim()) {
                              createFolder(newFolderName.trim());
                              setNewFolderName("");
                            }
                          }}
                          className="h-7 text-xs"
                        />
                        <Button
                          size="sm"
                          className="w-full text-xs h-7"
                          onClick={() => {
                            if (newFolderName.trim()) {
                              createFolder(newFolderName.trim());
                              setNewFolderName("");
                            }
                          }}
                        >
                          Créer
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
              {!isExpanded && (
                <div className="mx-4 mt-2 mb-1 border-t border-sidebar-border" />
              )}

              {/* Root-level pinned items (no folder) */}
              {pinnedApps
                .filter((a) => !a.folderId)
                .map((app, i) => renderPinnedItem(app, i))}

              {/* Folders */}
              {folders
                .filter((f) => !f.parentId)
                .map((folder) => {
                  const folderApps = pinnedApps.filter(
                    (a) => a.folderId === folder.id,
                  );
                  const subFolders = folders.filter(
                    (f) => f.parentId === folder.id,
                  );

                  if (!isExpanded) {
                    return folderApps.map((app, i) => renderPinnedItem(app, i));
                  }

                  return (
                    <div key={folder.id} className="mx-2">
                      {/* Folder header */}
                      <div
                        className="group flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
                        onClick={() => toggleFolder(folder.id)}
                        onDrop={(e) => {
                          e.preventDefault();
                          try {
                            const data = JSON.parse(
                              e.dataTransfer.getData("application/json"),
                            );
                            if (data.href) {
                              pinApp(data);
                              moveToFolder(data.href, folder.id);
                            }
                          } catch {}
                        }}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 transition-transform",
                            !folder.collapsed && "rotate-90",
                          )}
                        />
                        <Folder className="h-3.5 w-3.5 text-amber-500" />
                        {renamingFolder === folder.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                renameFolder(folder.id, renameValue);
                                setRenamingFolder(null);
                              }
                              if (e.key === "Escape") setRenamingFolder(null);
                            }}
                            onBlur={() => {
                              renameFolder(folder.id, renameValue);
                              setRenamingFolder(null);
                            }}
                            className="flex-1 bg-transparent text-xs outline-none border-b border-primary"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="flex-1 truncate">{folder.name}</span>
                        )}
                        <span className="text-[9px] text-muted-foreground/50">
                          {folderApps.length}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingFolder(folder.id);
                            setRenameValue(folder.name);
                          }}
                          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
                          title="Renommer"
                        >
                          <PenLine className="h-2.5 w-2.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFolder(folder.id);
                          }}
                          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          title="Supprimer le dossier"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>

                      {/* Folder contents */}
                      {!folder.collapsed && (
                        <div className="ml-3 border-l border-sidebar-border/50 pl-1">
                          {folderApps.map((app, i) => renderPinnedItem(app, i))}

                          {/* Sub-folders */}
                          {subFolders.map((sub) => {
                            const subApps = pinnedApps.filter(
                              (a) => a.folderId === sub.id,
                            );
                            return (
                              <div key={sub.id}>
                                <div
                                  className="group flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted cursor-pointer"
                                  onClick={() => toggleFolder(sub.id)}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    try {
                                      const data = JSON.parse(
                                        e.dataTransfer.getData(
                                          "application/json",
                                        ),
                                      );
                                      if (data.href) {
                                        pinApp(data);
                                        moveToFolder(data.href, sub.id);
                                      }
                                    } catch {}
                                  }}
                                  onDragOver={(e) => e.preventDefault()}
                                >
                                  <ChevronRight
                                    className={cn(
                                      "h-2.5 w-2.5 transition-transform",
                                      !sub.collapsed && "rotate-90",
                                    )}
                                  />
                                  <FolderOpen className="h-3 w-3 text-amber-400" />
                                  <span className="flex-1 truncate">
                                    {sub.name}
                                  </span>
                                  <span className="text-[8px] text-muted-foreground/50">
                                    {subApps.length}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteFolder(sub.id);
                                    }}
                                    className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                                  >
                                    <X className="h-2 w-2" />
                                  </button>
                                </div>
                                {!sub.collapsed && (
                                  <div className="ml-2 border-l border-sidebar-border/30 pl-1">
                                    {subApps.map((app, i) =>
                                      renderPinnedItem(app, i),
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Add sub-folder hint */}
                          {folderApps.length === 0 &&
                            subFolders.length === 0 && (
                              <p className="px-2 py-1 text-[9px] text-muted-foreground/40">
                                Glissez des apps ici
                              </p>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </>
          )}

          {/* Drop hint when sidebar has no pins */}
          {pinnedApps.length === 0 && folders.length === 0 && isExpanded && (
            <div className="mx-4 mt-3 border-t border-sidebar-border pt-3">
              <p className="px-2 text-[10px] text-muted-foreground/50 leading-relaxed">
                Glissez une app depuis le dashboard pour l&apos;épingler ici
              </p>
            </div>
          )}

          {/* Labels */}
          {isExpanded && (
            <div className="mx-4 mt-4 border-t border-sidebar-border pt-4">
              <div className="mb-2 flex items-center justify-between px-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Labels
                </h3>
                <Popover open={addLabelOpen} onOpenChange={setAddLabelOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Ajouter un label"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="right" className="w-56 space-y-3 p-3">
                    <p className="text-xs font-semibold">Nouveau label</p>
                    <Input
                      placeholder="Nom du label"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddLabel()}
                      className="h-8 text-xs"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {labelColors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewLabelColor(c)}
                          aria-label={`Couleur ${c}`}
                          aria-pressed={newLabelColor === c}
                          className={cn(
                            "h-5 w-5 rounded-full transition-all",
                            newLabelColor === c
                              ? "ring-2 ring-offset-2 ring-primary"
                              : "",
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={handleAddLabel}
                    >
                      Ajouter
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
              {labels.map((label) => (
                <div
                  key={label.id}
                  className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-muted"
                >
                  <Tag
                    className="h-4 w-4 shrink-0"
                    style={{ color: label.color }}
                  />
                  <span className="flex-1 truncate">{label.name}</span>
                  <button
                    onClick={() => removeLabel(label.id)}
                    aria-label={`Supprimer le label ${label.name}`}
                    className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">
                      Supprimer le label {label.name}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Version footer */}
        <div
          className={cn(
            "mt-auto pt-2 border-t border-sidebar-border text-[10px] text-muted-foreground/60",
            !isExpanded ? "text-center px-1" : "px-6",
          )}
        >
          {!isExpanded ? "v0.1" : "SignApps v0.1.0"}
        </div>
      </nav>

      {/* Context menu for pinned items */}
      {contextMenu && (
        <div
          className="fixed z-[100] rounded-lg border border-border bg-popover p-1 shadow-xl text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              unpinApp(contextMenu.href);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 rounded px-3 py-1.5 text-destructive transition-colors hover:bg-destructive/10 w-full text-left"
          >
            <X className="h-3.5 w-3.5" /> Désépingler
          </button>
        </div>
      )}
    </TooltipProvider>
  );
}
