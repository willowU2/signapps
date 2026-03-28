'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, Loader2, AlertCircle } from 'lucide-react';
import { storageApi, type ContentSearchResult } from '@/lib/api/storage';
import { toast } from 'sonner';

interface ContentSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBucket?: string;
  onSelectResult?: (result: ContentSearchResult) => void;
}

export function ContentSearchDialog({
  open,
  onOpenChange,
  currentBucket,
  onSelectResult,
}: ContentSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await storageApi.searchContent({
        q: query.trim(),
        bucket: currentBucket,
        limit: 50,
      });
      setResults(res.data);
    } catch (err: any) {
      if (err?.response?.status === 501 || err?.response?.status === 404) {
        toast.info('Full-text search is not yet enabled on the server');
        setResults([]);
      } else {
        toast.error('Échec de la recherche');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const highlightSnippet = (snippet: string, q: string) => {
    if (!q.trim()) return snippet;
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = snippet.split(re);
    return parts.map((p, i) =>
      re.test(p) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{p}</mark> : p
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search in File Contents
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Search within file text, code, documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
          />
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {currentBucket && (
          <p className="text-xs text-muted-foreground">
            Searching in bucket: <span className="font-mono">{currentBucket}</span>
          </p>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Searching...
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <AlertCircle className="h-8 w-8" />
              <p>Aucun résultat trouvé for "{query}"</p>
            </div>
          )}

          {!loading && results.map((r) => (
            <button
              key={r.file_id}
              className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              onClick={() => { onSelectResult?.(r); onOpenChange(false); }}
            >
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{r.name}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">{r.bucket}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      score: {r.score.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">{r.key}</p>
                  <p className="text-xs mt-1 text-muted-foreground leading-relaxed line-clamp-2">
                    {highlightSnippet(r.snippet, query)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {searched && results.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
