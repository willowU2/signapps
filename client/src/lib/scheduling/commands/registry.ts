/**
 * Command Registry
 * Story 1.4.2: Command Registry
 *
 * Central registry for all scheduling commands.
 * Provides hooks for accessing and filtering commands.
 */

import * as React from "react";
import {
  useCalendarStore,
  type CalendarState,
} from "@/stores/scheduling/calendar-store";
import {
  useSchedulingStore,
  type SchedulingState,
} from "@/stores/scheduling/scheduling-store";
import {
  usePreferencesStore,
  type PreferencesState,
} from "@/stores/scheduling/preferences-store";
import type { Command } from "../types/scheduling";
import type { ViewType, ScopeType, TimeItemType } from "../types/time-item";

// ============================================================================
// Command Registry State
// ============================================================================

const commandRegistry = new Map<string, Command>();

// ============================================================================
// Registry Functions
// ============================================================================

export function registerCommand(command: Command): void {
  commandRegistry.set(command.id, command);
}

export function unregisterCommand(id: string): void {
  commandRegistry.delete(id);
}

export function getCommand(id: string): Command | undefined {
  return commandRegistry.get(id);
}

export function getAllCommands(): Command[] {
  return Array.from(commandRegistry.values());
}

export function getCommandsByCategory(
  category: Command["category"],
): Command[] {
  return getAllCommands().filter((cmd) => cmd.category === category);
}

// ============================================================================
// Fuzzy Search
// ============================================================================

function fuzzyMatch(text: string, query: string): boolean {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Direct substring match
  if (textLower.includes(queryLower)) return true;

  // Fuzzy character match
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === queryLower.length;
}

function searchCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return commands;

  const queryLower = query.toLowerCase().trim();

  return commands.filter((command) => {
    // Match against label
    if (fuzzyMatch(command.label, queryLower)) return true;

    // Match against description
    if (command.description && fuzzyMatch(command.description, queryLower))
      return true;

    // Match against keywords
    if (command.keywords?.some((kw) => fuzzyMatch(kw, queryLower))) return true;

    return false;
  });
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to get all registered commands
 */
export function useCommands(): Command[] {
  const calendarStore = useCalendarStore();
  const schedulingStore = useSchedulingStore();
  const preferencesStore = usePreferencesStore();

  // Rebuild commands when store changes
  return React.useMemo(() => {
    return createDefaultCommands(
      calendarStore,
      schedulingStore,
      preferencesStore,
    );
  }, [calendarStore, schedulingStore, preferencesStore]);
}

/**
 * Hook to get filtered commands based on query
 */
export function useFilteredCommands(query: string): Command[] {
  const commands = useCommands();

  return React.useMemo(() => {
    return searchCommands(commands, query);
  }, [commands, query]);
}

// ============================================================================
// Default Commands Factory
// ============================================================================

function createDefaultCommands(
  calendarStore: CalendarState,
  schedulingStore: SchedulingState,
  preferencesStore: PreferencesState,
): Command[] {
  const commands: Command[] = [];

  // ----------------------------------------
  // Navigation Commands
  // ----------------------------------------

  commands.push({
    id: "nav-today",
    icon: "today",
    label: "Aujourd'hui",
    description: "Aller à la date du jour",
    shortcut: "T",
    category: "navigation",
    action: () => calendarStore.goToToday(),
    keywords: ["today", "maintenant", "now"],
  });

  commands.push({
    id: "nav-prev",
    icon: "arrow-left",
    label: "Précédent",
    description: "Période précédente",
    shortcut: "H",
    category: "navigation",
    action: () => calendarStore.navigateRelative("prev"),
    keywords: ["previous", "back", "arrière"],
  });

  commands.push({
    id: "nav-next",
    icon: "arrow-right",
    label: "Suivant",
    description: "Période suivante",
    shortcut: "L",
    category: "navigation",
    action: () => calendarStore.navigateRelative("next"),
    keywords: ["next", "forward", "avant"],
  });

  // View commands
  const views: { id: ViewType; label: string; key: string }[] = [
    { id: "day", label: "Vue Jour", key: "d" },
    { id: "week", label: "Vue Semaine", key: "w" },
    { id: "month", label: "Vue Mois", key: "m" },
    { id: "agenda", label: "Vue Agenda", key: "a" },
    { id: "timeline", label: "Vue Timeline", key: "t" },
    { id: "kanban", label: "Vue Kanban", key: "k" },
    { id: "heatmap", label: "Vue Heatmap", key: "h" },
    { id: "focus", label: "Mode Focus", key: "f" },
    { id: "roster", label: "Vue Roster", key: "r" },
  ];

  for (const view of views) {
    commands.push({
      id: `view-${view.id}`,
      icon: "calendar-days",
      label: view.label,
      description: `Passer en ${view.label.toLowerCase()}`,
      shortcut: view.key,
      category: "navigation",
      action: () => calendarStore.setView(view.id),
      keywords: [view.id, "vue", "view"],
    });
  }

  // Scope commands
  const scopes: { id: ScopeType; label: string; key: string }[] = [
    { id: "moi", label: "Moi (Personnel)", key: "m" },
    { id: "eux", label: "Eux (Équipe)", key: "e" },
    { id: "nous", label: "Nous (Collaboratif)", key: "n" },
  ];

  for (const scope of scopes) {
    commands.push({
      id: `scope-${scope.id}`,
      icon:
        scope.id === "moi"
          ? "user"
          : scope.id === "eux"
            ? "users"
            : "hand-shake",
      label: scope.label,
      description: `Passer en mode ${scope.label}`,
      category: "navigation",
      action: () => schedulingStore.setScope(scope.id),
      keywords: [scope.id, "scope", "portée"],
    });
  }

  // ----------------------------------------
  // Create Commands
  // ----------------------------------------

  const itemTypes: { id: TimeItemType; label: string; icon: string }[] = [
    { id: "event", label: "Nouvel événement", icon: "calendar-plus" },
    { id: "task", label: "Nouvelle tâche", icon: "check-square" },
    { id: "booking", label: "Nouvelle réservation", icon: "calendar-check" },
    { id: "shift", label: "Nouveau shift", icon: "user-cog" },
    { id: "milestone", label: "Nouveau jalon", icon: "flag" },
    { id: "reminder", label: "Nouveau rappel", icon: "bell" },
    { id: "blocker", label: "Nouveau blocage", icon: "x-circle" },
  ];

  for (const itemType of itemTypes) {
    commands.push({
      id: `create-${itemType.id}`,
      icon: itemType.icon,
      label: itemType.label,
      description: `Créer un nouveau ${itemType.label.toLowerCase().replace("nouveau ", "").replace("nouvelle ", "")}`,
      shortcut: itemType.id === "event" ? "N" : undefined,
      category: "create",
      action: () => {
        // Will trigger QuickCreate with the item type
      },
      keywords: ["new", "nouveau", "créer", "create", itemType.id],
    });
  }

  // ----------------------------------------
  // Action Commands
  // ----------------------------------------

  commands.push({
    id: "toggle-weekends",
    icon: "calendar",
    label: "Afficher les weekends",
    description: calendarStore.showWeekends
      ? "Masquer samedi et dimanche"
      : "Afficher samedi et dimanche",
    category: "action",
    action: () => calendarStore.toggleWeekends(),
    keywords: ["weekend", "samedi", "dimanche", "saturday", "sunday"],
  });

  commands.push({
    id: "toggle-compact",
    icon: "layout",
    label: "Mode compact",
    description: calendarStore.compactMode
      ? "Désactiver le mode compact"
      : "Activer le mode compact",
    category: "action",
    action: () => calendarStore.toggleCompactMode(),
    keywords: ["compact", "dense", "condensé"],
  });

  commands.push({
    id: "refresh",
    icon: "refresh-cw",
    label: "Actualiser",
    description: "Recharger les données",
    shortcut: "Shift+R",
    category: "action",
    action: () => {
      const dateRange = calendarStore.getDateRange();
      schedulingStore.fetchTimeItems(dateRange);
    },
    keywords: ["refresh", "reload", "actualiser", "recharger"],
  });

  // ----------------------------------------
  // Filter Commands
  // ----------------------------------------

  commands.push({
    id: "filter-clear",
    icon: "x",
    label: "Effacer les filtres",
    description: "Supprimer tous les filtres actifs",
    category: "action",
    action: () => schedulingStore.clearFilters(),
    keywords: ["clear", "reset", "effacer", "filtres"],
  });

  // ----------------------------------------
  // Search Commands
  // ----------------------------------------

  commands.push({
    id: "search-items",
    icon: "search",
    label: "Rechercher",
    description: "Trouver un élément par titre ou description",
    shortcut: "/",
    category: "search",
    action: () => {
      // Will open search modal
    },
    keywords: ["find", "search", "chercher", "trouver"],
  });

  return commands;
}
