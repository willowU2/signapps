'use client';

import { useMemo } from 'react';

interface FileTypeData {
  type: string;
  count: number;
  size: number;
}

const TYPE_COLORS: Record<string, string> = {
  document: '#3b82f6',
  spreadsheet: '#22c55e',
  presentation: '#eab308',
  image: '#a855f7',
  video: '#ec4899',
  audio: '#f97316',
  archive: '#6b7280',
  code: '#06b6d4',
  pdf: '#ef4444',
  other: '#9ca3af',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileType(name: string, mime?: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return 'document';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
  if (['ppt', 'pptx'].includes(ext)) return 'presentation';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'flac', 'ogg', 'aac'].includes(ext)) return 'audio';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['ts', 'js', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) return 'code';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

interface FileTypeChartProps {
  files: { name: string; size?: number; mime_type?: string }[];
}

export function FileTypeChart({ files }: FileTypeChartProps) {
  const distribution = useMemo(() => {
    const map = new Map<string, FileTypeData>();
    for (const f of files) {
      const type = getFileType(f.name, f.mime_type);
      const existing = map.get(type) || { type, count: 0, size: 0 };
      existing.count++;
      existing.size += f.size || 0;
      map.set(type, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [files]);

  const totalFiles = files.length;

  if (totalFiles === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Aucun fichier</p>;
  }

  return (
    <div className="space-y-3">
      {/* Bar chart */}
      <div className="flex h-4 rounded-full overflow-hidden bg-muted">
        {distribution.map((d) => (
          <div
            key={d.type}
            style={{
              width: `${(d.count / totalFiles) * 100}%`,
              backgroundColor: TYPE_COLORS[d.type] || TYPE_COLORS.other,
            }}
            title={`${d.type}: ${d.count} fichiers`}
            className="transition-all duration-500"
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {distribution.map((d) => (
          <div key={d.type} className="flex items-center gap-2 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: TYPE_COLORS[d.type] || TYPE_COLORS.other }}
            />
            <span className="capitalize flex-1">{d.type}</span>
            <span className="text-muted-foreground">{d.count}</span>
            <span className="text-muted-foreground">{formatBytes(d.size)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { getFileType };
