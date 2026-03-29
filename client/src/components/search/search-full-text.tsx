'use client';

// Feature 22: Full-text search within file content

import { useState, useCallback } from 'react';
import { FileText, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getClient, ServiceName } from '@/lib/api/factory';

interface FullTextMatch {
  fileId: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  matches: Array<{
    line: number;
    text: string;
    highlight: string;
  }>;
}

export function FullTextSearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FullTextMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const client = getClient(ServiceName.STORAGE);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 3) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await client.get<FullTextMatch[]>('/search/fulltext', {
        params: { q, limit: 20 },
      });
      setResults(data);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [client]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search(query);
  };

  const highlight = (text: string, term: string) => {
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return parts.map((p, i) =>
      p.toLowerCase() === term.toLowerCase()
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{p}</mark>
        : p
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher dans le contenu des fichiers…"
            className="pl-8"
          />
        </div>
        <Button onClick={() => search(query)} disabled={loading || query.length < 3} size="sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Chercher'}
        </Button>
      </div>

      {searched && !loading && results.length === 0 && (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <FileText className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">Aucun fichier contenant "{query}"</p>
        </div>
      )}

      <ScrollArea className="max-h-96">
        <div className="space-y-3">
          {results.map(r => (
            <div key={r.fileId} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                <a href={r.fileUrl} className="text-sm font-medium hover:underline truncate">{r.fileName}</a>
                <Badge variant="outline" className="text-xs shrink-0">{r.matches.length} occ.</Badge>
              </div>
              <div className="space-y-1 pl-6">
                {r.matches.slice(0, 3).map((m, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    <span className="text-xs font-mono bg-muted px-1 rounded mr-2">L{m.line}</span>
                    <span>{highlight(m.text, query)}</span>
                  </div>
                ))}
                {r.matches.length > 3 && (
                  <p className="text-xs text-muted-foreground pl-6">+{r.matches.length - 3} autres occurrences</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
