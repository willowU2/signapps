/**
 * Command Registry
 *
 * Central registry for all scheduling commands.
 * Provides hooks for accessing and filtering commands.
 */

import * as React from 'react';
import { useSchedulingNavigation, useSchedulingUI, useSchedulingStore } from '@/stores/scheduling-store';
import type { Command, ViewType, TabType } from '../types/scheduling';

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

export function getCommandsByCategory(category: Command['category']): Command[] {
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
    if (command.description && fuzzyMatch(command.description, queryLower)) return true;

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
  const store = useSchedulingStore();
  const navigation = useSchedulingNavigation();
  const ui = useSchedulingUI();

  // Rebuild commands when store changes
  return React.useMemo(() => {
    return createDefaultCommands(store, navigation, ui);
  }, [store, navigation, ui]);
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
  store: ReturnType<typeof useSchedulingStore>,
  navigation: ReturnType<typeof useSchedulingNavigation>,
  ui: ReturnType<typeof useSchedulingUI>
): Command[] {
  const commands: Command[] = [];

  // ----------------------------------------
  // Navigation Commands
  // ----------------------------------------

  commands.push({
    id: 'nav-today',
    icon: 'today',
    label: "Aujourd'hui",
    description: 'Aller à la date du jour',
    shortcut: 'T',
    category: 'navigation',
    action: () => navigation.goToToday(),
    keywords: ['today', 'maintenant', 'now'],
  });

  commands.push({
    id: 'nav-prev',
    icon: 'arrow-left',
    label: 'Précédent',
    description: 'Période précédente',
    shortcut: 'H',
    category: 'navigation',
    action: () => navigation.navigatePrev(),
    keywords: ['previous', 'back', 'arrière'],
  });

  commands.push({
    id: 'nav-next',
    icon: 'arrow-right',
    label: 'Suivant',
    description: 'Période suivante',
    shortcut: 'L',
    category: 'navigation',
    action: () => navigation.navigateNext(),
    keywords: ['next', 'forward', 'avant'],
  });

  // View commands
  const views: { id: ViewType; label: string; key: string }[] = [
    { id: 'agenda', label: 'Vue Agenda', key: '1' },
    { id: 'day', label: 'Vue Jour', key: '2' },
    { id: '3-day', label: 'Vue 3 Jours', key: '3' },
    { id: 'week', label: 'Vue Semaine', key: '4' },
    { id: 'month', label: 'Vue Mois', key: '5' },
  ];

  for (const view of views) {
    commands.push({
      id: `view-${view.id}`,
      icon: 'calendar-days',
      label: view.label,
      description: `Passer en ${view.label.toLowerCase()}`,
      shortcut: view.key,
      category: 'navigation',
      action: () => navigation.setActiveView(view.id),
      keywords: [view.id, 'vue', 'view'],
    });
  }

  // Tab commands
  const tabs: { id: TabType; label: string; key: string }[] = [
    { id: 'my-day', label: 'Ma Journée', key: 'D' },
    { id: 'tasks', label: 'Tâches', key: 'Shift+T' },
    { id: 'resources', label: 'Ressources', key: 'R' },
    { id: 'team', label: 'Équipe', key: 'E' },
  ];

  for (const tab of tabs) {
    commands.push({
      id: `tab-${tab.id}`,
      icon: tab.id === 'my-day' ? 'calendar' : tab.id === 'tasks' ? 'check' : tab.id === 'resources' ? 'building' : 'users',
      label: tab.label,
      description: `Aller à ${tab.label}`,
      shortcut: tab.key,
      category: 'navigation',
      action: () => navigation.setActiveTab(tab.id),
      keywords: [tab.id, 'onglet', 'tab'],
    });
  }

  // ----------------------------------------
  // Create Commands
  // ----------------------------------------

  commands.push({
    id: 'create-event',
    icon: 'calendar-plus',
    label: 'Nouvel événement',
    description: 'Créer un nouvel événement',
    shortcut: 'N',
    category: 'create',
    action: () => {
      // Will be implemented with QuickCreate
      console.log('Create event');
    },
    keywords: ['new', 'event', 'nouveau', 'événement', 'créer', 'create'],
  });

  commands.push({
    id: 'create-task',
    icon: 'check',
    label: 'Nouvelle tâche',
    description: 'Créer une nouvelle tâche',
    category: 'create',
    action: () => {
      console.log('Create task');
    },
    keywords: ['new', 'task', 'nouvelle', 'tâche', 'todo'],
  });

  commands.push({
    id: 'create-booking',
    icon: 'building',
    label: 'Nouvelle réservation',
    description: 'Réserver une ressource',
    category: 'create',
    action: () => {
      console.log('Create booking');
    },
    keywords: ['new', 'booking', 'réservation', 'salle', 'room'],
  });

  // ----------------------------------------
  // Action Commands
  // ----------------------------------------

  commands.push({
    id: 'toggle-sidebar',
    icon: 'settings',
    label: 'Basculer la sidebar',
    description: 'Afficher/masquer la barre latérale',
    shortcut: '[',
    category: 'action',
    action: () => ui.toggleSidebar(),
    keywords: ['sidebar', 'toggle', 'menu', 'barre'],
  });

  commands.push({
    id: 'toggle-weekends',
    icon: 'calendar',
    label: 'Afficher les weekends',
    description: ui.filters.showWeekends
      ? 'Masquer samedi et dimanche'
      : 'Afficher samedi et dimanche',
    category: 'action',
    action: () => ui.setFilters({ showWeekends: !ui.filters.showWeekends }),
    keywords: ['weekend', 'samedi', 'dimanche', 'saturday', 'sunday'],
  });

  commands.push({
    id: 'toggle-all-day',
    icon: 'clock',
    label: 'Événements journée',
    description: ui.filters.showAllDay
      ? 'Masquer les événements journée entière'
      : 'Afficher les événements journée entière',
    category: 'action',
    action: () => ui.setFilters({ showAllDay: !ui.filters.showAllDay }),
    keywords: ['all-day', 'journée', 'entière', 'full'],
  });

  // ----------------------------------------
  // Search Commands (placeholders)
  // ----------------------------------------

  commands.push({
    id: 'search-events',
    icon: 'search',
    label: 'Rechercher des événements',
    description: 'Trouver un événement par titre ou description',
    shortcut: '/',
    category: 'search',
    action: () => {
      console.log('Search events');
    },
    keywords: ['find', 'search', 'chercher', 'trouver'],
  });

  return commands;
}
