'use client';

// Feature 16: Command palette with module-specific actions
// Feature 7: Recent items in command palette

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail, CheckSquare, FileText, Users, Calendar, Folder,
  BarChart, Settings, Plus, Search, Clock, Bookmark,
  Zap, ArrowRight,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useSearchHistory } from '@/hooks/use-search-history';
import { useSearchBookmarks } from '@/hooks/use-search-bookmarks';

type ModuleAction = {
  id: string;
  module: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  shortcut?: string;
};

interface CommandPaletteExtendedProps {
  open: boolean;
  onClose: () => void;
}

const MODULE_ACTIONS: Omit<ModuleAction, 'action'>[] = [
  { id: 'new-mail', module: 'Mail', label: 'Nouveau message', icon: <Mail className="w-4 h-4" />, shortcut: '⌘N' },
  { id: 'new-task', module: 'Tâches', label: 'Nouvelle tâche', icon: <CheckSquare className="w-4 h-4" /> },
  { id: 'new-doc', module: 'Documents', label: 'Nouveau document', icon: <FileText className="w-4 h-4" /> },
  { id: 'new-contact', module: 'Contacts', label: 'Nouveau contact', icon: <Users className="w-4 h-4" /> },
  { id: 'new-event', module: 'Calendrier', label: 'Nouvel événement', icon: <Calendar className="w-4 h-4" /> },
  { id: 'new-folder', module: 'Drive', label: 'Nouveau dossier', icon: <Folder className="w-4 h-4" /> },
  { id: 'goto-dashboard', module: 'Navigation', label: 'Tableau de bord', icon: <BarChart className="w-4 h-4" /> },
  { id: 'goto-settings', module: 'Navigation', label: 'Paramètres', icon: <Settings className="w-4 h-4" /> },
  { id: 'new-automation', module: 'Automation', label: 'Nouvelle automation', icon: <Zap className="w-4 h-4" /> },
];

const ROUTE_MAP: Record<string, string> = {
  'new-mail': '/mail/compose',
  'new-task': '/tasks/new',
  'new-doc': '/docs/new',
  'new-contact': '/contacts/new',
  'new-event': '/calendar/new',
  'new-folder': '/drive',
  'goto-dashboard': '/dashboard',
  'goto-settings': '/settings',
  'new-automation': '/automation',
};

export function CommandPaletteExtended({ open, onClose }: CommandPaletteExtendedProps) {
  const router = useRouter();
  const { getRecentItems, getSuggestions } = useSearchHistory();
  const { bookmarks } = useSearchBookmarks();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const navigate = useCallback((url: string) => {
    router.push(url);
    onClose();
  }, [router, onClose]);

  const actions: ModuleAction[] = MODULE_ACTIONS.map(a => ({
    ...a,
    action: () => navigate(ROUTE_MAP[a.id] || '/'),
  }));

  const suggestions = getSuggestions(search);
  const recentItems = getRecentItems(5);

  const groupedActions = actions.reduce<Record<string, ModuleAction[]>>((acc, a) => {
    (acc[a.module] = acc[a.module] || []).push(a);
    return acc;
  }, {});

  const filtered = search
    ? actions.filter(a => a.label.toLowerCase().includes(search.toLowerCase()) || a.module.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <CommandDialog open={open} onOpenChange={v => !v && onClose()}>
      <CommandInput
        placeholder="Tapez une commande, recherchez ou naviguez…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Aucun résultat pour "{search}"</CommandEmpty>

        {/* Search suggestions from history */}
        {!search && suggestions.filter(s => s.query).length > 0 && (
          <CommandGroup heading="Recherches récentes">
            {suggestions.filter(s => s.query).slice(0, 4).map(s => (
              <CommandItem key={s.id} onSelect={() => { navigate(`/search?q=${encodeURIComponent(s.query!)}`); }}>
                <Search className="w-4 h-4 mr-2 text-muted-foreground" />
                {s.title}
                <Badge variant="secondary" className="ml-auto text-xs">Recherche</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Recent items */}
        {!search && recentItems.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Récemment visités">
              {recentItems.map(item => (
                <CommandItem key={item.id} onSelect={() => navigate(item.url)}>
                  <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                  {item.title}
                  <Badge variant="outline" className="ml-auto text-xs capitalize">{item.module}</Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Bookmarked search results */}
        {!search && bookmarks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Favoris">
              {bookmarks.slice(0, 4).map(b => (
                <CommandItem key={b.id} onSelect={() => navigate(b.url)}>
                  <Bookmark className="w-4 h-4 mr-2 text-yellow-500" />
                  {b.title}
                  <Badge variant="secondary" className="ml-auto text-xs capitalize">{b.entityType}</Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Filtered actions */}
        {search && filtered.length > 0 && (
          <CommandGroup heading="Actions">
            {filtered.map(a => (
              <CommandItem key={a.id} onSelect={a.action}>
                {a.icon}
                <span className="ml-2">{a.label}</span>
                <Badge variant="outline" className="ml-2 text-xs">{a.module}</Badge>
                {a.shortcut && <span className="ml-auto text-xs text-muted-foreground">{a.shortcut}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Module-grouped actions */}
        {!search && Object.entries(groupedActions).map(([module, moduleActions], i) => (
          <div key={module}>
            {i > 0 && <CommandSeparator />}
            <CommandGroup heading={module}>
              {moduleActions.map(a => (
                <CommandItem key={a.id} onSelect={a.action}>
                  {a.icon}
                  <span className="ml-2">{a.label}</span>
                  {a.shortcut && <span className="ml-auto text-xs text-muted-foreground">{a.shortcut}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
