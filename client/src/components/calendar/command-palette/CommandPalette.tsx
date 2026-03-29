'use client';

/**
 * CommandPalette Component
 * Story 1.4.1: Command Palette Component
 *
 * Modal command palette for quick actions in the scheduling UI.
 * Supports fuzzy search, keyboard navigation, and categorized commands.
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePreferencesStore } from '@/stores/calendar-store';
import { CommandList, CommandListEmpty } from './CommandList';
import { useCommands, useFilteredCommands } from '@/lib/scheduling/commands/registry';
import type { Command } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface CommandPaletteProps {
  className?: string;
}

// ============================================================================
// Backdrop Component
// ============================================================================

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

// ============================================================================
// Search Input Component
// ============================================================================

function SearchInput({
  value,
  onChange,
  onClear,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <Search className="h-5 w-5 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher une commande..."
        className={cn(
          'flex-1 bg-transparent text-sm outline-none',
          'placeholder:text-muted-foreground'
        )}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {value && (
        <button
          onClick={onClear}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Footer Component
// ============================================================================

function Footer() {
  return (
    <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1.5 py-0.5">↑↓</kbd>
          naviguer
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1.5 py-0.5">↵</kbd>
          sélectionner
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd>
          fermer
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CommandPalette({ className }: CommandPaletteProps) {
  const isCommandPaletteOpen = usePreferencesStore((state) => state.isCommandPaletteOpen);
  const closeCommandPalette = usePreferencesStore((state) => state.closeCommandPalette);
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Get commands
  const allCommands = useCommands();
  const filteredCommands = useFilteredCommands(query);

  // Reset selection when query changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  React.useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!isCommandPaletteOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          closeCommandPalette();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, filteredCommands, selectedIndex, closeCommandPalette]);

  const executeCommand = (command: Command) => {
    closeCommandPalette();
    // Small delay to allow modal to close before action
    setTimeout(() => command.action(), 50);
  };

  const handleSelect = (command: Command) => {
    executeCommand(command);
  };

  const handleHighlight = (index: number) => {
    setSelectedIndex(index);
  };

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <>
          <Backdrop onClick={closeCommandPalette} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'fixed left-1/2 top-[20%] -translate-x-1/2 z-50',
              'w-full max-w-lg',
              'rounded-xl border bg-background shadow-2xl',
              'overflow-hidden',
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Palette de commandes"
          >
            {/* Search */}
            <SearchInput
              value={query}
              onChange={setQuery}
              onClear={() => setQuery('')}
              inputRef={inputRef}
            />

            {/* Command List */}
            <div className="max-h-[400px] overflow-auto">
              {filteredCommands.length > 0 ? (
                <CommandList
                  commands={filteredCommands}
                  selectedIndex={selectedIndex}
                  onSelect={handleSelect}
                  onHighlight={handleHighlight}
                />
              ) : query ? (
                <CommandListEmpty query={query} />
              ) : (
                <CommandList
                  commands={allCommands}
                  selectedIndex={selectedIndex}
                  onSelect={handleSelect}
                  onHighlight={handleHighlight}
                />
              )}
            </div>

            {/* Footer */}
            <Footer />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;
