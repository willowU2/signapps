'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Upload,
  Trash2,
  Copy,
  GripVertical,
  Film,
  Filter,
  SortAsc,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { socialApi, MediaItem } from '@/lib/api/social';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterType = 'all' | 'images' | 'videos';
type SortType = 'newest' | 'oldest' | 'name' | 'size';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const ACCEPTED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch media list from API on mount
  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      const res = await socialApi.media.list();
      setItems(res.data);
    } catch {
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // ------ Upload logic ------

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type));
    if (validFiles.length === 0) return;

    setUploading(true);
    const newItems: MediaItem[] = [];

    for (const file of validFiles) {
      const objectUrl = URL.createObjectURL(file);
      try {
        const res = await socialApi.media.create({
          url: objectUrl,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        });
        newItems.push(res.data);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...newItems, ...prev]);
      toast.success(`Uploaded ${newItems.length} file${newItems.length > 1 ? 's' : ''}`);
    }
    setUploading(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files);
      e.target.value = '';
    },
    [processFiles],
  );

  // ------ Drop zone handlers ------

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles],
  );

  // ------ Actions ------

  const handleDelete = useCallback(async (id: string) => {
    try {
      await socialApi.media.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success('Media deleted');
    } catch {
      toast.error('Impossible de supprimer media');
    }
  }, []);

  const handleCopyUrl = useCallback((item: MediaItem) => {
    navigator.clipboard.writeText(item.url).then(
      () => toast.success('URL copied to clipboard'),
      () => toast.error('Failed to copy URL'),
    );
  }, []);

  // ------ Drag-to-reorder ------

  const handleItemDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleItemDragEnterCard = useCallback((index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleItemDragEnd = useCallback(() => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      setItems((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(dragIndex, 1);
        updated.splice(dragOverIndex, 0, moved);
        return updated;
      });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverIndex]);

  // ------ Filter & sort ------

  const processed = useMemo(() => {
    let list = [...items];

    // Filter
    if (filter === 'images') list = list.filter((i) => i.mimeType.startsWith('image/'));
    else if (filter === 'videos') list = list.filter((i) => i.mimeType.startsWith('video/'));

    // Sort
    switch (sort) {
      case 'newest':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'name':
        list.sort((a, b) => a.filename.localeCompare(b.filename));
        break;
      case 'size':
        list.sort((a, b) => b.size - a.size);
        break;
    }

    return list;
  }, [items, filter, sort]);

  // ------ Render ------

  const filterLabel: Record<FilterType, string> = { all: 'All', images: 'Images', videos: 'Videos' };
  const sortLabel: Record<SortType, string> = { newest: 'Newest', oldest: 'Oldest', name: 'Name', size: 'Size' };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage images and videos for your social posts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {filterLabel[filter]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(filterLabel) as FilterType[]).map((f) => (
                <DropdownMenuItem key={f} onClick={() => setFilter(f)}>
                  {filterLabel[f]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <SortAsc className="h-4 w-4 mr-2" />
                {sortLabel[sort]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(sortLabel) as SortType[]).map((s) => (
                <DropdownMenuItem key={s} onClick={() => setSort(s)}>
                  {sortLabel[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Upload button */}
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <Separator />

      {/* Content */}
      {items.length === 0 ? (
        /* Empty state -- large dashed upload zone */
        <div
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 transition-colors ${
            isDraggingOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium text-muted-foreground mb-1">
            No media yet
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Drag &amp; drop images or videos here, or click to browse
          </p>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Browse Files
          </Button>
        </div>
      ) : (
        <>
          {/* Drop overlay when dragging files from OS */}
          <div
            className={`relative ${isDraggingOver ? 'ring-2 ring-primary rounded-xl' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDraggingOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/5 rounded-xl border-2 border-dashed border-primary">
                <p className="text-primary font-medium">Drop files to upload</p>
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {processed.map((item, index) => {
                const isImage = item.mimeType.startsWith('image/');
                return (
                  <Card
                    key={item.id}
                    draggable
                    onDragStart={() => handleItemDragStart(index)}
                    onDragEnter={() => handleItemDragEnterCard(index)}
                    onDragEnd={handleItemDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={`group relative overflow-hidden cursor-grab transition-all ${
                      dragOverIndex === index ? 'ring-2 ring-primary' : ''
                    } ${dragIndex === index ? 'opacity-50' : ''}`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-square bg-muted">
                      {isImage ? (
                        <img
                          src={item.url}
                          alt={item.filename}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <video
                          src={item.url}
                          className="h-full w-full object-cover"
                          muted
                          preload="metadata"
                        />
                      )}

                      {/* Video badge */}
                      {!isImage && (
                        <Badge
                          variant="secondary"
                          className="absolute top-2 left-2 gap-1 text-xs"
                        >
                          <Film className="h-3 w-3" />
                          Video
                        </Badge>
                      )}

                      {/* Hover overlay with actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyUrl(item);
                          }}
                          title="Copy URL"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(item.url, '_blank');
                          }}
                          title="Open in new tab"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Drag handle */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <GripVertical className="h-5 w-5 text-white drop-shadow" />
                      </div>
                    </div>

                    {/* Info */}
                    <CardContent className="p-3 space-y-0.5">
                      <p className="text-sm font-medium truncate" title={item.filename}>
                        {item.filename}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatFileSize(item.size)}</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="text-sm text-muted-foreground text-center pt-2">
            {processed.length} item{processed.length !== 1 ? 's' : ''}
            {filter !== 'all' && ` (${filterLabel[filter].toLowerCase()})`}
            {' — '}
            {formatFileSize(processed.reduce((sum, i) => sum + i.size, 0))} total
          </div>
        </>
      )}
    </div>
  );
}
