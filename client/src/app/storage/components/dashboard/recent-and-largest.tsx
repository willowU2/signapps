'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, FileUp, FileText, Image, FileArchive, FileCode, Film, Music } from 'lucide-react';
import { searchApi } from '@/lib/api';

interface RecentFile {
  key: string;
  filename: string;
  bucket: string;
  size: number;
  content_type?: string;
  modified_at?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'A l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Il y a ${diffDays}j`;
}

function getFileIcon(filename: string, contentType?: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (contentType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return <Image className="h-4 w-4 text-pink-500" />;
  }
  if (contentType?.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
    return <Film className="h-4 w-4 text-blue-500" />;
  }
  if (contentType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
    return <Music className="h-4 w-4 text-violet-500" />;
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return <FileArchive className="h-4 w-4 text-amber-500" />;
  }
  if (['js', 'ts', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'json', 'html', 'css'].includes(ext)) {
    return <FileCode className="h-4 w-4 text-green-500" />;
  }
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function RecentUploads() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecent() {
      try {
        const response = await searchApi.recent(10);
        setRecentFiles(response.data || []);
      } catch {
        setRecentFiles([]);
      } finally {
        setLoading(false);
      }
    }
    fetchRecent();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5" />
          Fichiers Recents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileUp className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun fichier recent</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentFiles.map((file, i) => (
              <div
                key={`${file.bucket}-${file.key}-${i}`}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
              >
                {getFileIcon(file.filename, file.content_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {file.bucket} - {formatBytes(file.size)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTimeAgo(file.modified_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LargestFiles() {
  const [largestFiles, setLargestFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLargest() {
      try {
        // Fetch recent files and sort by size (the API doesn't have a direct
        // "largest" endpoint, so we reuse recent with a larger batch)
        const response = await searchApi.recent(50);
        const files: RecentFile[] = response.data || [];
        const sorted = [...files].sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 8);
        setLargestFiles(sorted);
      } catch {
        setLargestFiles([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLargest();
  }, []);

  // Find the max file size for the bar chart
  const maxSize = largestFiles.length > 0 ? Math.max(...largestFiles.map((f) => f.size || 0)) : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="h-5 w-5" />
          Plus Gros Fichiers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : largestFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun fichier trouve</p>
          </div>
        ) : (
          <div className="space-y-2">
            {largestFiles.map((file, i) => {
              const widthPercent = maxSize > 0 ? ((file.size || 0) / maxSize) * 100 : 0;
              return (
                <div key={`${file.bucket}-${file.key}-${i}`} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getFileIcon(file.filename, file.content_type)}
                      <span className="truncate">{file.filename}</span>
                    </div>
                    <span className="text-muted-foreground ml-2 whitespace-nowrap font-mono text-xs">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all duration-500"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
