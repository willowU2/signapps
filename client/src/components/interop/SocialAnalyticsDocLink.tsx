'use client';

/**
 * Feature 6: Social analytics → link to doc/content
 * Feature 26: Social → track link clicks to shared docs
 */

import { useState } from 'react';
import { BarChart2, Link, ExternalLink, TrendingUp, MousePointer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { socialApi } from '@/lib/api/social';
import type { SocialPost } from '@/lib/api/social';
import { formatDistanceToNow } from 'date-fns';

interface PostWithDocLink extends SocialPost {
  docLink?: string;
  docName?: string;
}

function extractDocLink(content: string): string | null {
  const match = content.match(/https?:\/\/[^\s]+\/docs\/editor[^\s]*/);
  return match ? match[0] : null;
}

export function SocialAnalyticsDocLink() {
  const [open, setOpen] = useState(false);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['social-posts-with-docs'],
    queryFn: async () => {
      const res = await socialApi.posts.list({ status: 'published', limit: 50 });
      const rawPosts: SocialPost[] = (res?.data as any)?.items ?? (res?.data as any)?.posts ?? [];
      return rawPosts.map((p) => ({
        ...p,
        docLink: extractDocLink(p.content),
      })).filter((p) => p.docLink) as PostWithDocLink[];
    },
    enabled: open,
  });

  const totalClicks = posts.reduce((acc, p) => acc + ((p as any).engagementCount ?? 0), 0);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <BarChart2 className="h-3.5 w-3.5" />
        Docs partagés
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Analytics — Documents partagés
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <p className="text-2xl font-bold">{posts.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Posts avec lien doc</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-center">
              <p className="text-2xl font-bold">{totalClicks}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Interactions totales</p>
            </div>
          </div>

          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">Chargement...</p>
          )}

          {!isLoading && posts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun post avec lien vers un document trouvé.
            </p>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {posts.map((post) => (
              <div key={post.id} className="rounded-lg border p-3 text-sm space-y-2">
                <p className="line-clamp-2 text-foreground">{post.content}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MousePointer className="h-3 w-3" />
                    {(post as any).engagementCount ?? 0} interactions
                  </span>
                  <span>{post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : ''}</span>
                </div>
                {post.docLink && (
                  <a href={post.docLink} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Link className="h-3 w-3" />
                    <span className="truncate max-w-[280px]">{post.docLink}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}
                <div className="flex flex-wrap gap-1">
                  {((post as any).accounts ?? []).slice(0, 3).map((id: string) => (
                    <Badge key={id} variant="secondary" className="text-xs">{id.slice(0, 8)}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
