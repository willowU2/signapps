'use client';

import { useState, useEffect, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, X, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FacetType = 'email' | 'document' | 'contact' | 'deal' | 'task' | 'event';

export interface FacetFilters {
  types: FacetType[];
  dateFrom: Date | null;
  dateTo: Date | null;
  author: string;
  tags: string[];
}

interface FacetCount {
  type: FacetType;
  label: string;
  count: number;
  color: string;
}

interface FacetedSearchProps {
  facetCounts?: Partial<Record<FacetType, number>>;
  onChange: (filters: FacetFilters) => void;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FACET_TYPES: FacetCount[] = [
  { type: 'email', label: 'Email', count: 0, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { type: 'document', label: 'Document', count: 0, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { type: 'contact', label: 'Contact', count: 0, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { type: 'deal', label: 'Opportunité', count: 0, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { type: 'task', label: 'Tâche', count: 0, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { type: 'event', label: 'Événement', count: 0, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
];

const SAMPLE_TAGS = ['urgent', 'client', 'projet', 'finance', 'RH', 'IT', 'contrat'];

// ─── DatePicker helper ────────────────────────────────────────────────────────

function DatePickerButton({ value, onChange, placeholder }: { value: Date | null; onChange: (d: Date | null) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8 font-normal">
          <CalendarDays className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
          {value ? format(value, 'dd/MM/yyyy') : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={d => { onChange(d ?? null); setOpen(false); }}
          locale={fr}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FacetedSearch({ facetCounts = {}, onChange, className = '' }: FacetedSearchProps) {
  const [types, setTypes] = useState<FacetType[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [author, setAuthor] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const emitChange = useCallback((
    t: FacetType[], df: Date | null, dt: Date | null, a: string, tg: string[]
  ) => {
    onChange({ types: t, dateFrom: df, dateTo: dt, author: a, tags: tg });
  }, [onChange]);

  useEffect(() => {
    emitChange(types, dateFrom, dateTo, author, tags);
  }, [types, dateFrom, dateTo, author, tags, emitChange]);

  const toggleType = (type: FacetType) => {
    setTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const hasFilters = types.length > 0 || dateFrom || dateTo || author || tags.length > 0;

  const clearAll = () => {
    setTypes([]); setDateFrom(null); setDateTo(null); setAuthor(''); setTags([]);
  };

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Filtres</span>
          {hasFilters && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {types.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (author ? 1 : 0) + tags.length}
            </Badge>
          )}
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>
            <X className="h-3 w-3 mr-1" />Réinitialiser
          </Button>
        )}
      </div>

      {/* Type facets */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</p>
        {FACET_TYPES.map(f => {
          const count = facetCounts[f.type] ?? 0;
          const checked = types.includes(f.type);
          return (
            <div key={f.type} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`facet-${f.type}`}
                  checked={checked}
                  onCheckedChange={() => toggleType(f.type)}
                />
                <Label htmlFor={`facet-${f.type}`} className="text-sm cursor-pointer">
                  {f.label}
                </Label>
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${f.color}`}>
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Date range */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Période</p>
        <div className="space-y-1.5">
          <DatePickerButton value={dateFrom} onChange={setDateFrom} placeholder="Date de début" />
          <DatePickerButton value={dateTo} onChange={setDateTo} placeholder="Date de fin" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-6 text-xs w-full text-muted-foreground" onClick={() => { setDateFrom(null); setDateTo(null); }}>
            <X className="h-3 w-3 mr-1" />Effacer la période
          </Button>
        )}
      </div>

      {/* Author */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auteur</p>
        <Input
          placeholder="Nom ou email..."
          value={author}
          onChange={e => setAuthor(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_TAGS.map(tag => {
            const selected = tags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
