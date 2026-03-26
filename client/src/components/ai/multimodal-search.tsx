'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  FileText,
  Image as ImageIcon,
  AudioWaveform,
  Video,
  Upload,
  X,
  Database,
} from 'lucide-react';
import { getClient, ServiceName } from '@/lib/api/factory';
import { SpinnerInfinity } from 'spinners-react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  relevance: number;
  type: 'document' | 'image' | 'audio' | 'video';
  collection?: string;
  metadata?: Record<string, string>;
}

interface MultimodalSearchProps {
  onSearch?: (query: string) => void;
}

type TabType = 'all' | 'documents' | 'images' | 'audio' | 'video';

const TABS: { key: TabType; label: string; icon: typeof FileText }[] = [
  { key: 'all', label: 'Tout', icon: Search },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'images', label: 'Images', icon: ImageIcon },
  { key: 'audio', label: 'Audio', icon: AudioWaveform },
  { key: 'video', label: 'Video', icon: Video },
];

const COLLECTIONS = [
  { value: 'all', label: 'Toutes les collections' },
  { value: 'documents', label: 'Documents' },
  { value: 'images', label: 'Images' },
  { value: 'knowledge-base', label: 'Base de connaissances' },
  { value: 'media', label: 'Media' },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function relevanceColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-orange-500';
}

function typeIcon(type: string) {
  switch (type) {
    case 'document':
      return <FileText className="h-4 w-4 text-blue-600" />;
    case 'image':
      return <ImageIcon className="h-4 w-4 text-purple-600" />;
    case 'audio':
      return <AudioWaveform className="h-4 w-4 text-green-600" />;
    case 'video':
      return <Video className="h-4 w-4 text-red-600" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function MultimodalSearch({ onSearch }: MultimodalSearchProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [collection, setCollection] = useState('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(async () => {
    if (!query.trim() && !uploadedImage) return;
    setIsSearching(true);
    setError(null);

    try {
      const client = getClient(ServiceName.AI);

      if (uploadedImage) {
        // Visual search with image upload
        const formData = new FormData();
        formData.append('image', uploadedImage);
        if (query.trim()) formData.append('query', query.trim());
        if (collection !== 'all') formData.append('collection', collection);

        const res = await client.post<{ results: SearchResult[] }>(
          '/ai/search/visual',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        const data = res.data;
        setResults(Array.isArray(data) ? data : data.results ?? []);
      } else {
        // Text search
        const params: Record<string, string | number> = {
          q: query.trim(),
          limit: 20,
        };
        if (collection !== 'all') params.collection = collection;
        if (activeTab !== 'all') params.type = activeTab;

        const res = await client.get<{ results: SearchResult[] }>('/ai/search', {
          params,
        });
        const data = res.data;
        setResults(Array.isArray(data) ? data : data.results ?? []);
      }

      onSearch?.(query);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de recherche';
      setError(message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, uploadedImage, collection, activeTab, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') performSearch();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filter results by active tab
  const filteredResults =
    activeTab === 'all'
      ? results
      : results.filter((r) => {
          if (activeTab === 'documents') return r.type === 'document';
          if (activeTab === 'images') return r.type === 'image';
          if (activeTab === 'audio') return r.type === 'audio';
          if (activeTab === 'video') return r.type === 'video';
          return true;
        });

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Search Bar + Image Upload */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                placeholder="Rechercher dans documents, images, audio..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>

            {/* Image upload button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              title="Recherche visuelle"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            {/* Collection filter */}
            <Select value={collection} onValueChange={setCollection}>
              <SelectTrigger className="w-52">
                <Database className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLLECTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search button */}
            <Button
              onClick={performSearch}
              disabled={(!query.trim() && !uploadedImage) || isSearching}
              className="px-4"
            >
              {isSearching ? (
                <SpinnerInfinity
                  size={16}
                  secondaryColor="rgba(255,255,255,0.3)"
                  color="currentColor"
                  speed={120}
                  className="h-4 w-4"
                />
              ) : (
                'Rechercher'
              )}
            </Button>
          </div>

          {/* Image preview */}
          {imagePreview && (
            <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
              <img
                src={imagePreview}
                alt="Apercu recherche visuelle"
                className="h-16 w-16 rounded object-cover"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Recherche visuelle</p>
                <p className="text-xs text-muted-foreground">
                  {uploadedImage?.name} ({((uploadedImage?.size ?? 0) / 1024).toFixed(0)} KB)
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={removeImage}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Type tabs */}
          <div className="flex gap-1 border-b">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const count =
                tab.key === 'all'
                  ? results.length
                  : results.filter((r) => {
                      if (tab.key === 'documents') return r.type === 'document';
                      if (tab.key === 'images') return r.type === 'image';
                      if (tab.key === 'audio') return r.type === 'audio';
                      if (tab.key === 'video') return r.type === 'video';
                      return false;
                    }).length;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {results.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">
                      {count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive text-center py-2">{error}</p>
          )}

          {/* Results grid */}
          <div className="space-y-2 min-h-32 max-h-[28rem] overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-12">
                <SpinnerInfinity
                  size={24}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="h-8 w-8"
                />
              </div>
            ) : filteredResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {query || uploadedImage
                  ? 'Aucun resultat trouve'
                  : 'Entrez un terme de recherche ou uploadez une image'}
              </p>
            ) : (
              filteredResults.map((result) => (
                <div
                  key={result.id}
                  className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{typeIcon(result.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        {result.collection && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {result.collection}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {result.snippet}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                      <span className="text-xs font-semibold">
                        {result.relevance}%
                      </span>
                      <Progress
                        value={result.relevance}
                        className={`h-1.5 w-12 [&>div]:${relevanceColor(result.relevance)}`}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
