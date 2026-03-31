'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Search,
  Loader2,
  FileText,
  Sparkles,
  X,
} from 'lucide-react';
import { aiApi, SearchResult } from '@/lib/api';
import { toast } from 'sonner';

interface SemanticSearchProps {
  /** Restrict search to specific collections */
  collections?: string[];
  /** Maximum results to return */
  limit?: number;
  /** Callback when a result is selected */
  onResultClick?: (result: SearchResult) => void;
  /** Show as standalone card or inline */
  variant?: 'card' | 'inline';
}

export function SemanticSearch({
  collections,
  limit = 10,
  onResultClick,
  variant = 'card',
}: SemanticSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);

      try {
        const response = await aiApi.search(searchQuery, limit, collections);
        setResults(response.data);
      } catch (error) {
        toast.error('Semantic search failed');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [collections, limit]
  );

  const handleSearch = () => {
    performSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);

    // Debounced auto-search after 500ms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 500);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  const escapeHtml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const highlightMatch = (text: string, searchQuery: string) => {
    // Escape HTML first to prevent XSS from search result content
    const escaped = escapeHtml(text);
    if (!searchQuery.trim()) return escaped;

    const words = searchQuery.trim().split(/\s+/).filter(Boolean);
    let highlighted = escaped;

    for (const word of words) {
      const escapedWord = escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedWord})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">$1</mark>');
    }

    return highlighted;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 dark:text-green-400';
    if (score >= 0.6) return 'text-blue-600 dark:text-blue-400';
    if (score >= 0.4) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-muted-foreground';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-blue-500';
    if (score >= 0.4) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const content = (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            placeholder="Rechercher..."
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-8"
          />
          <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          onClick={handleSearch}
          disabled={!query.trim() || isSearching}
          className="px-4"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Results */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {isSearching && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Searching semantically...</span>
          </div>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No semantically similar results found</p>
            <p className="text-xs mt-1">Try rephrasing your query</p>
          </div>
        )}

        {!isSearching && !hasSearched && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Semantic search powered by pgvector</p>
            <p className="text-xs mt-1">
              Finds documents by meaning, not just keywords
            </p>
          </div>
        )}

        {!isSearching &&
          results.map((result) => (
            <div
              key={result.id}
              onClick={() => onResultClick?.(result)}
              className={`p-3 border rounded-lg transition-colors ${
                onResultClick
                  ? 'hover:bg-accent cursor-pointer'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">
                    {result.filename}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className={`text-xs font-semibold ${getScoreColor(result.score)}`}>
                    {Math.round(result.score * 100)}%
                  </span>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getScoreBarColor(result.score)} transition-all`}
                      style={{ width: `${result.score * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              <p
                className="text-xs text-muted-foreground line-clamp-3"
                dangerouslySetInnerHTML={{
                  __html: highlightMatch(result.content, query),
                }}
              />
            </div>
          ))}

        {!isSearching && results.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            {results.length} result{results.length !== 1 ? 's' : ''} found by
            semantic similarity
          </p>
        )}
      </div>
    </div>
  );

  if (variant === 'inline') {
    return content;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" />
          Semantic Search
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
