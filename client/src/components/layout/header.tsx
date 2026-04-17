/* eslint-disable @next/next/no-img-element */
"use client";

import { useUIStore, useAuthStore } from "@/lib/store";
import { useBrandingStore } from "@/stores/branding-store";
import { Button } from "@/components/ui/button";
import {
  Moon,
  Sun,
  Menu,
  HelpCircle,
  Settings,
  LayoutGrid,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import { NotificationPopover } from "@/components/notifications/notification-popover";
import { ChangelogDialog } from "@/components/onboarding/ChangelogDialog";
import { ContextSwitcher } from "@/components/layout/context-switcher";
import Link from "next/link";

const LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  docs: "Documents",
  sheets: "Classeurs",
  slides: "Présentations",
  mail: "Mail",
  contacts: "Contacts",
  tasks: "Tâches",
  social: "Social",
  design: "Design",
  keep: "Notes",
  admin: "Administration",
  users: "Utilisateurs",
  settings: "Paramètres",
  crm: "CRM",
  billing: "Facturation",
  forms: "Formulaires",
  calendar: "Calendrier",
  chat: "Chat",
  meet: "Meet",
  drive: "Drive",
  projects: "Projets",
  apps: "App Store",
  containers: "Containers",
  ai: "IA",
  monitoring: "Monitoring",
  storage: "Stockage",
  analytics: "Analytique",
  workforce: "Workforce",
  media: "Média",
  resources: "Ressources",
  bookmarks: "Favoris",
  help: "Aide",
  profile: "Profil",
  preferences: "Préférences",
  notifications: "Notifications",
  webhooks: "Webhooks",
  security: "Sécurité",
  appearance: "Apparence",
  editor: "Éditeur",
  deals: "Pipeline",
  "it-assets": "IT Assets",
  backups: "Sauvegardes",
  vpn: "VPN",
  routes: "Routes",
  scheduler: "Planificateur",
  remote: "Accès distant",
  pxe: "PXE Deploy",
};

// SSR-safe mounted check without setState-in-effect
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function Header() {
  const { theme, setTheme, toggleSidebar } = useUIStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Build breadcrumb items from pathname
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbItems = pathSegments.map((segment, index) => {
    const url = `/${pathSegments.slice(0, index + 1).join("/")}`;
    const isLast = index === pathSegments.length - 1;
    const label =
      LABEL_MAP[segment] ||
      segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
    const displayLabel =
      label.length > 24 ? `${label.substring(0, 10)}…` : label;
    return { label: displayLabel, url, isLast };
  });
  // Branding from Zustand store (set by Settings > Appearance)
  const { logoUrl: instanceLogo, appName: instanceName } = useBrandingStore();

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme, mounted]);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header
      role="banner"
      aria-label="En-tete de l'application"
      className="h-16 flex shrink-0 items-center justify-between px-4 bg-card dark:bg-background border-b border-border z-50"
    >
      {/* Left: hamburger + logo */}
      <div className="flex items-center gap-2 md:gap-4 md:min-w-[240px]">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="rounded-full"
          aria-label="Basculer le menu lateral"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted"
          title="Tableau de bord"
        >
          {instanceLogo ? (
            <img
              src={instanceLogo}
              alt={instanceName ?? "Logo"}
              className="h-8 w-8 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              S
            </div>
          )}
          <span className="text-xl font-medium text-foreground/80 tracking-tight">
            {instanceName ?? "SignApps"}
          </span>
        </button>
      </div>

      {/* Center: Breadcrumbs */}
      {/* Center: inline breadcrumbs */}
      <nav
        aria-label="breadcrumb"
        className="hidden md:flex flex-1 items-center justify-center"
      >
        {breadcrumbItems.length > 0 && (
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <li className="inline-flex items-center">
              <Link
                href="/dashboard"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Accueil
              </Link>
            </li>
            {breadcrumbItems.map((item) => (
              <li key={item.url} className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground/40">/</span>
                {item.isLast ? (
                  <button
                    onClick={() => {
                      const event = new CustomEvent("reset-navigation", {
                        detail: { path: item.url },
                      });
                      window.dispatchEvent(event);
                    }}
                    className="text-xs font-semibold text-foreground hover:text-muted-foreground transition-colors"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    href={item.url}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </nav>

      {/* Right: actions */}
      <div className="flex items-center gap-1 md:min-w-[240px] justify-end">
        <ContextSwitcher />
        <span className="hidden md:inline-flex">
          <ChangelogDialog />
        </span>
        <NotificationPopover />

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex rounded-full text-muted-foreground"
          onClick={() => router.push("/settings")}
          title="Help"
          aria-label="Aide"
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex rounded-full text-muted-foreground"
          onClick={() =>
            router.push(
              pathname.startsWith("/mail") ? "/mail/settings" : "/settings",
            )
          }
          title="Paramètres"
          aria-label="Paramètres"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full text-muted-foreground"
          aria-label={
            mounted && theme === "dark"
              ? "Passer en mode clair"
              : "Passer en mode sombre"
          }
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Moon className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex rounded-full text-muted-foreground mr-2"
          title="Apps"
          aria-label="Applications"
        >
          <LayoutGrid className="h-5 w-5" aria-hidden="true" />
        </Button>

        {/* User avatar */}
        <button
          onClick={() => router.push("/settings/profile")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/30 text-xs font-semibold text-primary overflow-hidden"
          title={user?.display_name || user?.username || "Profil"}
          aria-label={user?.display_name || user?.username || "Profil"}
        >
          {user?.avatar_url ? (
            <img
              src={user.avatar_url}
              alt=""
              className="h-full w-full object-cover rounded-full"
            />
          ) : (
            getInitials(user?.display_name || user?.username)
          )}
        </button>
      </div>
    </header>
  );
}
