'use client';

// IDEA-122: RSS Feed widget for the extended widget library

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Rss, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

// Use rss2json free service as a CORS-friendly proxy for RSS feeds
async function fetchRssFeed(feedUrl: string): Promise<RssItem[]> {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=10`;
  const res = await fetch(apiUrl);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error('RSS fetch failed');
  return (data.items ?? []).map((item: Record<string, unknown>) => ({
    title: String(item.title ?? ''),
    link: String(item.link ?? ''),
    pubDate: String(item.pubDate ?? ''),
    description: String(item.description ?? '').replace(/<[^>]*>/g, '').slice(0, 120),
  }));
}

const DEFAULT_FEED = 'https://news.ycombinator.com/rss';

export function WidgetRssFeed({ widget }: WidgetRenderProps) {
  const config = widget.config as { feedUrl?: string; title?: string };
  const feedUrl = config.feedUrl ?? DEFAULT_FEED;
  const feedTitle = config.title ?? 'RSS Feed';

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['widget-rss', feedUrl],
    queryFn: () => fetchRssFeed(feedUrl),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Rss className="h-4 w-4 text-orange-500" />
          {feedTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        {isLoading && (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Flux RSS indisponible
          </div>
        )}
        {!isLoading && !error && (
          <ScrollArea className="h-full">
            <div className="divide-y">
              {items.map((item, i) => (
                <a
                  key={`${item.link}-${i}`}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 p-3 hover:bg-accent transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {item.pubDate && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(item.pubDate).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short'
                        })}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
