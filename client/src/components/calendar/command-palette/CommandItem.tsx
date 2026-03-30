'use client';

/**
 * CommandItem Component
 *
 * Individual command item in the command palette.
 * Shows icon, label, description, and keyboard shortcut.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
interface Command {
  id: string;
  label: string;
  category: string;
  action: () => void;
  shortcut?: string;
  icon?: string;
  description?: string;
}

// ============================================================================
// Types
// ============================================================================

interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
}

// ============================================================================
// Icon Component
// ============================================================================

function CommandIcon({ icon, className }: { icon: string | undefined; className?: string }) {
  // Map icon names to Lucide icons
  // This is a simple implementation - could be expanded with a full icon registry
  const iconMap: Record<string, string> = {
    calendar: '📅',
    'calendar-plus': '➕',
    'calendar-days': '📆',
    search: '🔍',
    settings: '⚙️',
    home: '🏠',
    clock: '⏰',
    users: '👥',
    building: '🏢',
    check: '✓',
    plus: '+',
    'arrow-left': '←',
    'arrow-right': '→',
    today: '📌',
  };

  return (
    <span className={cn('text-base', className)}>
      {(icon && iconMap[icon]) || '•'}
    </span>
  );
}

// ============================================================================
// Keyboard Shortcut Component
// ============================================================================

function Shortcut({ keys }: { keys: string }) {
  const parts = keys.split('+');

  return (
    <div className="flex items-center gap-0.5">
      {parts.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-muted-foreground/50">+</span>}
          <kbd className="min-w-[20px] h-5 flex items-center justify-center rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            {key === 'Cmd' ? '⌘' : key === 'Ctrl' ? 'Ctrl' : key === 'Shift' ? '⇧' : key}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CommandItem({
  command,
  isSelected,
  onSelect,
  className,
}: CommandItemProps) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
        'focus:outline-none',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50',
        className
      )}
      onClick={onSelect}
      onMouseEnter={onSelect}
      role="option"
      aria-selected={isSelected}
    >
      {/* Icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <CommandIcon icon={command.icon} />
      </div>

      {/* Label & Description */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{command.label}</div>
        {command.description && (
          <div className="text-xs text-muted-foreground truncate">
            {command.description}
          </div>
        )}
      </div>

      {/* Shortcut */}
      {command.shortcut && <Shortcut keys={command.shortcut} />}
    </button>
  );
}

export default CommandItem;
