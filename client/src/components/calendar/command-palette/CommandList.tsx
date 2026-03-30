'use client';

/**
 * CommandList Component
 *
 * Filtered and categorized list of commands.
 * Groups commands by category with section headers.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CommandItem } from './CommandItem';
interface Command {
  id: string;
  label: string;
  category: string;
  action: () => void;
  shortcut?: string;
  icon?: React.ReactNode;
}

// ============================================================================
// Types
// ============================================================================

interface CommandListProps {
  commands: Command[];
  selectedIndex: number;
  onSelect: (command: Command) => void;
  onHighlight: (index: number) => void;
  className?: string;
}

interface CommandCategory {
  id: string;
  label: string;
  commands: Command[];
}

// ============================================================================
// Category Labels
// ============================================================================

const categoryLabels: Record<string, string> = {
  navigation: 'Navigation',
  create: 'Créer',
  search: 'Recherche',
  action: 'Actions',
};

// ============================================================================
// Component
// ============================================================================

export function CommandList({
  commands,
  selectedIndex,
  onSelect,
  onHighlight,
  className,
}: CommandListProps) {
  // Group commands by category
  const categories = React.useMemo(() => {
    const grouped = new Map<string, Command[]>();

    for (const command of commands) {
      const category = command.category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(command);
    }

    const result: CommandCategory[] = [];
    const order = ['navigation', 'create', 'search', 'action'];

    for (const categoryId of order) {
      const categoryCommands = grouped.get(categoryId);
      if (categoryCommands && categoryCommands.length > 0) {
        result.push({
          id: categoryId,
          label: categoryLabels[categoryId] || categoryId,
          commands: categoryCommands,
        });
      }
    }

    return result;
  }, [commands]);

  // Flatten for index tracking
  const flatCommands = React.useMemo(() => {
    return categories.flatMap((cat) => cat.commands);
  }, [categories]);

  if (commands.length === 0) {
    return (
      <div className={cn('py-8 text-center text-sm text-muted-foreground', className)}>
        Aucune commande trouvée
      </div>
    );
  }

  let globalIndex = 0;

  return (
    <div className={cn('py-2', className)} role="listbox">
      {categories.map((category) => (
        <div key={category.id} className="mb-2 last:mb-0">
          {/* Category Header */}
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {category.label}
          </div>

          {/* Commands */}
          <div className="px-1">
            {category.commands.map((command) => {
              const currentIndex = globalIndex++;
              const isSelected = currentIndex === selectedIndex;

              return (
                <CommandItem
                  key={command.id}
                  command={command}
                  isSelected={isSelected}
                  onSelect={() => onSelect(command)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

export function CommandListEmpty({
  query,
  className,
}: {
  query: string;
  className?: string;
}) {
  return (
    <div className={cn('py-12 text-center', className)}>
      <div className="text-4xl mb-4">🔍</div>
      <h3 className="text-sm font-medium mb-1">Aucun résultat</h3>
      <p className="text-xs text-muted-foreground">
        Aucune commande ne correspond à "{query}"
      </p>
    </div>
  );
}

export default CommandList;
