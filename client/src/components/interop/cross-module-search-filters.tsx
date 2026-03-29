'use client';

// Idea 46: Cross-module search filters — combine filters from multiple modules
// Idea 47: Unified contacts — contacts shared between CRM, Mail, Calendar, Chat

import { useState, useCallback, useMemo } from 'react';
import { Search, Filter, Users, X, Loader2, Mail, Calendar, MessageCircle, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { getClient, ServiceName } from '@/lib/api/factory';

const identityClient = () => getClient(ServiceName.IDENTITY);
const contactsClient = () => getClient(ServiceName.CONTACTS);

const SEARCHABLE_MODULES = [
  { id: 'docs', label: 'Documents', icon: '📄', color: 'bg-blue-100 text-blue-700' },
  { id: 'mail', label: 'Emails', icon: '✉️', color: 'bg-orange-100 text-orange-700' },
  { id: 'tasks', label: 'Tâches', icon: '✅', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'contacts', label: 'Contacts', icon: '👤', color: 'bg-purple-100 text-purple-700' },
  { id: 'calendar', label: 'Calendrier', icon: '📅', color: 'bg-green-100 text-green-700' },
  { id: 'drive', label: 'Drive', icon: '📁', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'chat', label: 'Chat', icon: '💬', color: 'bg-pink-100 text-pink-700' },
  { id: 'sheets', label: 'Sheets', icon: '📊', color: 'bg-emerald-100 text-emerald-700' },
];

interface SearchResult {
  id: string;
  title: string;
  module: string;
  snippet?: string;
  url: string;
  updated_at: string;
}

/** Idea 46 – Cross-module search with module filters */
export function CrossModuleSearchBar() {
  const [query, setQuery] = useState('');
  const [enabledModules, setEnabledModules] = useState<string[]>(SEARCHABLE_MODULES.map(m => m.id));
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const toggleModule = (id: string) => {
    setEnabledModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await identityClient().get<SearchResult[]>('/search/cross-module', {
        params: { q, modules: enabledModules.join(',') },
      });
      setResults(data.slice(0, 15));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [enabledModules]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    const timer = setTimeout(() => search(val), 300);
    return () => clearTimeout(timer);
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Recherche globale…"
            value={query}
            onChange={handleInput}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            className="pl-8 h-9"
          />
          {loading && <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-9 gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <Badge variant="secondary" className="text-xs h-4 px-1">{enabledModules.length}</Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="end">
            <p className="text-xs font-medium mb-2">Modules de recherche</p>
            <div className="space-y-1.5">
              {SEARCHABLE_MODULES.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`sf-${m.id}`}
                    checked={enabledModules.includes(m.id)}
                    onCheckedChange={() => toggleModule(m.id)}
                  />
                  <Label htmlFor={`sf-${m.id}`} className="text-xs cursor-pointer flex items-center gap-1.5">
                    <span>{m.icon}</span>{m.label}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {open && query && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
          <ScrollArea className="max-h-64">
            {results.length === 0 && !loading && (
              <div className="p-4 text-center text-sm text-muted-foreground">Aucun résultat</div>
            )}
            {results.map(r => {
              const mod = SEARCHABLE_MODULES.find(m => m.id === r.module);
              return (
                <a key={r.id} href={r.url} className="flex items-start gap-3 p-2.5 hover:bg-muted/50 border-b last:border-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${mod?.color || 'bg-muted text-muted-foreground'}`}>
                    {mod?.icon || '🔍'} {mod?.label || r.module}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    {r.snippet && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.snippet}</p>}
                  </div>
                </a>
              );
            })}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

interface UnifiedContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  present_in: string[];
}

/** Idea 47 – Unified contact view across CRM, Mail, Calendar, Chat */
export function UnifiedContactCard({ email }: { email: string }) {
  const [contact, setContact] = useState<UnifiedContact | null>(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    contactsClient().get<UnifiedContact>('/contacts/unified', { params: { email } })
      .then(({ data }) => setContact(data))
      .catch(() => setContact(null))
      .finally(() => setLoading(false));
  });

  if (loading) return <div className="animate-pulse h-12 w-48 rounded bg-muted" />;
  if (!contact) return null;

  const MODULE_ICONS: Record<string, React.ReactNode> = {
    crm: <Briefcase className="w-3 h-3" />,
    mail: <Mail className="w-3 h-3" />,
    calendar: <Calendar className="w-3 h-3" />,
    chat: <MessageCircle className="w-3 h-3" />,
    contacts: <Users className="w-3 h-3" />,
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border">
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
        {contact.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{contact.name}</p>
        <p className="text-xs text-muted-foreground">{contact.email}</p>
        <div className="flex gap-1 mt-0.5">
          {contact.present_in.map(m => (
            <span key={m} className="text-muted-foreground" title={m}>
              {MODULE_ICONS[m] || <span className="text-[10px]">{m}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
