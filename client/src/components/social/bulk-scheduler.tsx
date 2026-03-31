'use client';

import { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, XCircle, Loader2, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSocialStore } from '@/stores/social-store';
import { PLATFORM_CHAR_LIMITS, PLATFORM_LABELS } from './platform-utils';
import { toast } from 'sonner';
import { isFuture, parseISO } from 'date-fns';

const VALID_PLATFORMS = new Set(Object.keys(PLATFORM_LABELS));
const CSV_TEMPLATE = `date,time,platform,text,image_url,hashtags
2026-04-01,09:00,twitter,"Hello from SignApps! 🚀","","#socialmedia #marketing"
2026-04-01,10:00,linkedin,"Excited to share our latest update","https://example.com/image.jpg","#product #startup"
2026-04-02,14:00,instagram,"Check out this amazing content!","","#instagood #content"`;

interface CsvRow {
  date: string;
  time: string;
  platform: string;
  text: string;
  image_url: string;
  hashtags: string;
}

interface ParsedPost {
  row: number;
  date: string;
  time: string;
  platform: string;
  text: string;
  imageUrl: string;
  hashtags: string[];
  errors: string[];
  scheduledAt: Date | null;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  return lines.slice(1).map((line) => {
    // Handle quoted fields with commas inside
    const fields: string[] = [];
    let inQuote = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuote = !inQuote;
      } else if (line[i] === ',' && !inQuote) {
        fields.push(current.trim());
        current = '';
      } else {
        current += line[i];
      }
    }
    fields.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (fields[i] ?? '').replace(/^"|"$/g, '').trim();
    });
    return row as unknown as CsvRow;
  });
}

function validateRow(row: CsvRow, index: number): ParsedPost {
  const errors: string[] = [];
  let scheduledAt: Date | null = null;

  if (!row.date || !row.time) {
    errors.push('Missing date or time');
  } else {
    try {
      scheduledAt = parseISO(`${row.date}T${row.time}:00`);
      if (isNaN(scheduledAt.getTime())) {
        errors.push('Invalid date/time format (use YYYY-MM-DD and HH:MM)');
        scheduledAt = null;
      } else if (!isFuture(scheduledAt)) {
        errors.push('Date must be in the future');
        scheduledAt = null;
      }
    } catch {
      errors.push('Invalid date/time');
    }
  }

  if (!row.platform) {
    errors.push('Platform is required');
  } else if (!VALID_PLATFORMS.has(row.platform.toLowerCase())) {
    errors.push(`Unknown platform "${row.platform}"`);
  }

  if (!row.text || row.text.trim().length === 0) {
    errors.push('Text is required');
  } else {
    const limit = PLATFORM_CHAR_LIMITS[row.platform.toLowerCase()] ?? 280;
    if (row.text.length > limit) {
      errors.push(`Text too long for ${row.platform} (${row.text.length}/${limit})`);
    }
  }

  const hashtags = row.hashtags
    ? row.hashtags
        .split(/[\s,]+/)
        .map((h) => h.trim().replace(/^#/, ''))
        .filter(Boolean)
    : [];

  return {
    row: index + 2,
    date: row.date,
    time: row.time,
    platform: row.platform?.toLowerCase() ?? '',
    text: row.text,
    imageUrl: row.image_url,
    hashtags,
    errors,
    scheduledAt,
  };
}

export function BulkScheduler() {
  const { createPost, schedulePost } = useSocialStore();
  const [posts, setPosts] = useState<ParsedPost[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const rows = parseCsv(content);
      const parsed = rows.map((row, i) => validateRow(row, i));
      setPosts(parsed);
      setResults(null);
      if (parsed.length === 0) {
        toast.error('No valid rows found in CSV');
      } else {
        toast.success(`Parsed ${parsed.length} row${parsed.length !== 1 ? 's' : ''}`);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleScheduleAll = async () => {
    const valid = posts.filter((p) => p.errors.length === 0 && p.scheduledAt);
    if (valid.length === 0) {
      toast.error('No valid posts to schedule');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < valid.length; i++) {
      const p = valid[i];
      try {
        const post = await createPost({
          content: p.text,
          hashtags: p.hashtags,
          mediaUrls: p.imageUrl ? [p.imageUrl] : [],
          status: 'draft',
        });
        await schedulePost(post.id, p.scheduledAt!.toISOString());
        success++;
      } catch {
        failed++;
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100));
    }

    setResults({ success, failed });
    setIsProcessing(false);
    toast.success(`Done: ${success} scheduled, ${failed} failed`);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-schedule-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = posts.filter((p) => p.errors.length === 0).length;
  const invalidCount = posts.filter((p) => p.errors.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Bulk Scheduler</h2>
          <p className="text-sm text-muted-foreground">Upload a CSV to schedule multiple posts at once</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
          <Download className="w-4 h-4" />
          Download Template
        </Button>
      </div>

      {/* Upload area */}
      <Card
        className="border-dashed cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
          <Upload className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm font-medium">Click to upload CSV file</p>
          <p className="text-xs text-muted-foreground">Columns: date, time, platform, text, image_url, hashtags</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
        </CardContent>
      </Card>

      {/* Preview table */}
      {posts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Preview — {posts.length} rows
              <Badge variant="secondary" className="ml-auto">
                <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                {validCount} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" />
                  {invalidCount} errors
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-3">Row</th>
                    <th className="text-left py-2 pr-3">Date & Time</th>
                    <th className="text-left py-2 pr-3">Platform</th>
                    <th className="text-left py-2 pr-3">Text</th>
                    <th className="text-left py-2 pr-3">Hashtags</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p, i) => (
                    <tr key={i} className={`border-b last:border-0 ${p.errors.length > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                      <td className="py-2 pr-3 text-muted-foreground">{p.row}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {p.date} {p.time}
                      </td>
                      <td className="py-2 pr-3 capitalize">{p.platform}</td>
                      <td className="py-2 pr-3 max-w-[200px] truncate" title={p.text}>
                        {p.text}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {p.hashtags.map((h) => `#${h}`).join(' ')}
                      </td>
                      <td className="py-2">
                        {p.errors.length > 0 ? (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            {p.errors[0]}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">{progress}% — scheduling posts…</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <div className="text-sm">
            <span className="font-medium text-green-600">{results.success} posts scheduled</span>
            {results.failed > 0 && (
              <span className="text-red-500 ml-2">{results.failed} failed</span>
            )}
          </div>
        </div>
      )}

      {/* Schedule button */}
      {posts.length > 0 && !isProcessing && (
        <Button onClick={handleScheduleAll} disabled={validCount === 0} className="w-full gap-2">
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          Schedule {validCount} post{validCount !== 1 ? 's' : ''}
        </Button>
      )}
    </div>
  );
}
