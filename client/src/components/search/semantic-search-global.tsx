'use client';

import { useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Loader2,
  FileText,
  Mail,
  User,
  Briefcase,
  Sparkles,
  X,
} from 'lucide-react';
import { aiApi, SearchResult } from '@/lib/api/ai';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

type ResultType = 'email' | 'document' | 'contact' | 'deal' | 'other';

interface GroupedResults {
  emails: SearchResult[];
  documents: SearchResult[];
  contacts: SearchResult[];
  deals: SearchResult[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function detectType(result: SearchResult): ResultType {
  const fn = result.filename?.toLowerCase() ?? '';
  if (fn.includes('email') || fn.includes('mail') || fn.endsWith('.eml')) return 'email';
  if (fn.includes('contact') || fn.includes('vcard') || fn.endsWith('.vcf')) return 'contact';
  if (fn.includes('deal') || fn.includes('crm') || fn.includes('opportunite')) return 'deal';
  if (
    fn.endsWith('.pdf') ||
    fn.endsWith('.docx') ||
    fn.endsWith('.doc') ||
    fn.includes('document') ||
    fn.includes('rapport')
  )
    return 'document';
  return 'other';
}

function groupResults(results: SearchResult[]): GroupedResults {
  const groups: GroupedResults = { emails: [], documents: [], contacts: [], deals: [] };
  for (const r of results) {
    const type = detectType(r);
    if (type === 'email') groups.emails.push(r);
    else if (type === 'contact') groups.contacts.push(r);
    else if (type === 'deal') groups.deals.push(r);
    else groups.documents.push(r);
  }
  return groups;
}

function getScoreBarWidth(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-blue-500';
  if (score >= 0.4) return 'bg-yellow-500';
  return 'bg-gray-400';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ResultType, string> = {
  email: 'Emails',
  document: 'Documents',
  contact: 'Contacts',
  deal: 'Deals',
  other: 'Autres',
};

const TYPE_ICONS: Record<ResultType, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  contact: <User className="h-3.5 w-3.5" />,
  deal: <Briefcase className="h-3.5 w-3.5" />,
  other: <FileText className="h-3.5 w-3.5" />,
};

function ResultGroup({
  type,
  results,
  onSelect,
}: {
  type: ResultType;
  results: SearchResult[];
  onSelect?: (result: SearchResult) => void;
}) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 px-1 py-0.5">
        <span className="text-muted-foreground">{TYPE_ICONS[type]}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {TYPE_LABELS[type]}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
          {results.length}
        </Badge>
      </div>

      {results.map((result) => (
        <button
          key={result.id}
          onClick={() => onSelect?.(result)}
          className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{result.filename}</p>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {result.content}
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1 mt-0.5">
              <span className="text-[10px] text-muted-foreground font-mono">
                {Math.round(result.score * 100)}%
              </span>
              {/* Subtle relevance bar */}
              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full ${getScoreColor(result.score)} rounded-full transition-all`}
                  style={{ width: getScoreBarWidth(result.score) }}
                />
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SemanticSearchGlobalProps {
  /** Called when a result is clicked */
  onSelect?: (result: SearchResult) => void;
  /** Auto-focus the input */
  autoFocus?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Class name for the wrapper */
  className?: string;
}

export function SemanticSearchGlobal({
  onSelect,
  autoFocus = false,
  placeholder = 'Recherche intelligente...',
  className = '',
}: SemanticSearchGlobalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const resp = await aiApi.search(q, 20);
      setResults(resp.data);
    } catch {
      toast.error('Recherche sémantique indisponible');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => search(val), 350);
    } else {
      setResults([]);
      setHasSearched(false);
    }
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  const grouped = groupResults(results);
  const hasResults = results.length > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search input */}
      <div className="relative">
        <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(query)}
          className="pl-9 pr-8"
        />
        {isSearching ? (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        ) : query ? (
          <button onClick={clear} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {/* Results */}
      {hasSearched && !isSearching && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto">
          {!hasResults ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun résultat sémantique trouvé</p>
              <p className="text-xs mt-1 opacity-75">Essayez de reformuler votre requête</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground px-1">
                {results.length} résultat{results.length > 1 ? 's' : ''} par similarité sémantique
              </p>
              <ResultGroup type="email" results={grouped.emails} onSelect={onSelect} />
              <ResultGroup type="document" results={grouped.documents} onSelect={onSelect} />
              <ResultGroup type="contact" results={grouped.contacts} onSelect={onSelect} />
              <ResultGroup type="deal" results={grouped.deals} onSelect={onSelect} />
            </>
          )}
        </div>
      )}

      {!hasSearched && !query && (
        <div className="text-center py-6 text-muted-foreground">
          <Sparkles className="h-6 w-6 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Recherche par signification, pas seulement par mots-clés</p>
          <p className="text-xs opacity-60 mt-0.5">Résultats groupés par type : emails, docs, contacts, deals</p>
        </div>
      )}
    </div>
  );
}
