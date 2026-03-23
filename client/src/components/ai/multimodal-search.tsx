'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FileText, Image, AudioWaveform } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  relevance: number;
  type: 'document' | 'image' | 'audio';
}

interface MultimodalSearchProps {
  onSearch?: (query: string) => void;
}

export function MultimodalSearch({ onSearch }: MultimodalSearchProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'documents' | 'images' | 'audio'>('documents');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const mockResults: Record<string, SearchResult[]> = {
    documents: [
      {
        id: '1',
        title: 'Q4 Financial Report',
        snippet: 'Quarterly performance analysis for October-December 2025...',
        relevance: 95,
        type: 'document',
      },
      {
        id: '2',
        title: 'Budget Proposal 2026',
        snippet: 'Annual budget allocation across departments with...',
        relevance: 88,
        type: 'document',
      },
    ],
    images: [
      {
        id: '3',
        title: 'Whiteboard Meeting Notes',
        snippet: 'Strategy session whiteboard photography from March 2026',
        relevance: 82,
        type: 'image',
      },
      {
        id: '4',
        title: 'Process Diagram',
        snippet: 'Workflow visualization for onboarding process',
        relevance: 76,
        type: 'image',
      },
    ],
    audio: [
      {
        id: '5',
        title: 'Board Meeting Transcript',
        snippet: 'Quarterly review meeting audio transcript from Q1 2026',
        relevance: 91,
        type: 'audio',
      },
      {
        id: '6',
        title: 'Customer Interview Recording',
        snippet: 'Voice notes from customer feedback session discussing...',
        relevance: 79,
        type: 'audio',
      },
    ],
  };

  const performSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setResults(mockResults[activeTab] || []);
      onSearch?.(query);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') performSearch();
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'documents':
        return <FileText className="h-4 w-4" />;
      case 'images':
        return <Image className="h-4 w-4" />;
      case 'audio':
        return <AudioWaveform className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Search documents, images, audio..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
            <Button
              onClick={performSearch}
              disabled={!query.trim() || isSearching}
              className="px-4"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            {(['documents', 'images', 'audio'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {getTabIcon(tab)}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="space-y-3 min-h-32 max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">
                {query ? 'No results found' : 'Enter a search query'}
              </p>
            ) : (
              results.map((result) => (
                <div
                  key={result.id}
                  className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{result.title}</p>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-xs font-semibold text-blue-600">
                        {result.relevance}%
                      </span>
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${result.relevance}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">{result.snippet}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
