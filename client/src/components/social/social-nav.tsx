"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PenSquare,
  CalendarDays,
  Inbox,
  BarChart3,
  Bot,
  Image,
  Zap,
  FileText,
  Users,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/social", label: "Dashboard", icon: LayoutDashboard },
  { href: "/social/compose", label: "Compose", icon: PenSquare },
  { href: "/social/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/social/inbox", label: "Inbox", icon: Inbox },
  { href: "/social/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/social/agent", label: "AI Agent", icon: Bot },
  { href: "/social/media", label: "Media", icon: Image },
  { href: "/social/automation", label: "Automation", icon: Zap },
  { href: "/social/templates", label: "Templates", icon: FileText },
  { href: "/social/accounts", label: "Accounts", icon: Users },
  { href: "/social/settings", label: "Settings", icon: Settings },
] as const;

export function SocialNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/social"
              ? pathname === "/social"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
