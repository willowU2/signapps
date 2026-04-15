"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ModuleTheme = "light" | "dark" | "system";

interface ModuleConfig {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const MODULES: ModuleConfig[] = [
  { id: "docs", label: "Documents", icon: "📄", path: "/docs" },
  { id: "mail", label: "Mail", icon: "✉️", path: "/mail" },
  { id: "calendar", label: "Calendrier", icon: "📅", path: "/calendar" },
  { id: "chat", label: "Chat", icon: "💬", path: "/chat" },
  { id: "drive", label: "Drive", icon: "📁", path: "/drive" },
  { id: "tasks", label: "Tâches", icon: "✅", path: "/tasks" },
  { id: "dashboard", label: "Dashboard", icon: "📊", path: "/dashboard" },
  { id: "contacts", label: "Contacts", icon: "👥", path: "/contacts" },
];

const STORAGE_KEY = "signapps-module-themes";
const STYLE_ID = "signapps-module-dark";

function loadPrefs(): Record<string, ModuleTheme> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePrefs(prefs: Record<string, ModuleTheme>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function useModuleTheme(moduleId: string) {
  const [theme, setTheme] = useState<ModuleTheme>("system");

  useEffect(() => {
    const prefs = loadPrefs();
    setTheme(prefs[moduleId] || "system");
  }, [moduleId]);

  const applyModuleTheme = useCallback(
    (t: ModuleTheme) => {
      setTheme(t);
      const prefs = loadPrefs();
      prefs[moduleId] = t;
      savePrefs(prefs);

      // Apply/remove dark class on the module wrapper if in a module route
      if (typeof window === "undefined") return;
      const currentPath = window.location.pathname;
      const mod = MODULES.find((m) => m.id === moduleId);
      if (!mod || !currentPath.startsWith(mod.path)) return;

      const isDark =
        t === "dark" ||
        (t === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
    },
    [moduleId],
  );

  return { theme, setTheme: applyModuleTheme };
}

const THEME_OPTIONS: {
  value: ModuleTheme;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "system",
    label: "Système",
    icon: <Monitor className="w-3.5 h-3.5" />,
  },
  { value: "light", label: "Clair", icon: <Sun className="w-3.5 h-3.5" /> },
  { value: "dark", label: "Sombre", icon: <Moon className="w-3.5 h-3.5" /> },
];

export function ModuleDarkModeSettings() {
  const [prefs, setPrefs] = useState<Record<string, ModuleTheme>>({});

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const update = (moduleId: string, theme: ModuleTheme) => {
    const updated = { ...prefs, [moduleId]: theme };
    setPrefs(updated);
    savePrefs(updated);
  };

  const customized = Object.values(prefs).filter((v) => v !== "system").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Moon className="w-5 h-5" />
          Mode sombre par module
          {customized > 0 && (
            <Badge variant="secondary" className="text-xs">
              {customized} personnalisé(s)
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Définissez le mode clair/sombre indépendamment pour chaque section de
          l'application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {MODULES.map((mod) => {
            const current = prefs[mod.id] || "system";
            return (
              <div
                key={mod.id}
                className="flex items-center justify-between py-1"
              >
                <div className="flex items-center gap-2">
                  <span>{mod.icon}</span>
                  <span className="text-sm">{mod.label}</span>
                  {current !== "system" && (
                    <Badge variant="outline" className="text-xs h-4 px-1">
                      {current === "dark" ? "🌙" : "☀️"}
                    </Badge>
                  )}
                </div>
                <Select
                  value={current}
                  onValueChange={(v) => update(mod.id, v as ModuleTheme)}
                >
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-1.5">
                          {opt.icon}
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Note: Les préférences par module s'appliquent lors de la navigation
          dans la section correspondante.
        </p>
      </CardContent>
    </Card>
  );
}
