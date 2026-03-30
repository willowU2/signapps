'use client';

/**
 * Feature 30: Unified content library: docs + drive + social media assets
 */

import { useState } from 'react';
import { Library, FileText, HardDrive, Share2, Image, File, Folder, Search, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useQuery } from '@tanstack/react-query';
import { driveApi, DriveNode } from '@/lib/api/drive';
import { socialApi } from '@/lib/api/social';
import type { SocialPost } from '@/lib/api/social';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

type ContentItem =
  | { kind: 'doc'; node: DriveNode }
  | { kind: 'file'; node: DriveNode }
  | { kind: 'social'; post: SocialPost }
  | { kind: 'media'; url: string; name: string; postId: string };

export function UnifiedContentLibrary() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const { data: driveNodes = [], isLoading: loadingDrive } = useQuery<DriveNode[]>({
    queryKey: ['unified-library-drive'],
    queryFn: () => driveApi.listNodes(null),
    enabled: open,
  });

  const { data: posts = [], isLoading: loadingPosts } = useQuery<SocialPost[]>({
    queryKey: ['unified-library-social'],
    queryFn: async () => {
      const res = await socialApi.posts.list({ limit: 30 });
      return (res?.data as any)?.items ?? (res?.data as any)?.posts ?? [];
    },
    enabled: open,
  });

  const docs = driveNodes.filter((n) => n.node_type === 'document');
  const files = driveNodes.filter((n) => n.node_type === 'file');
  const mediaUrls: { url: string; name: string; postId: string }[] = posts
    .flatMap((p) => ((p as any).mediaUrls ?? []).map((url: string, i: number) => ({ url, name: `Media ${i + 1}`, postId: p.id })));

  const lower = search.toLowerCase();
  const filteredDocs = docs.filter((d) => !lower || d.name.toLowerCase().includes(lower));
  const filteredFiles = files.filter((f) => !lower || f.name.toLowerCase().includes(lower));
  const filteredPosts = posts.filter((p) => !lower || p.content.toLowerCase().includes(lower));
  const filteredMedia = mediaUrls.filter((m) => !lower || m.name.toLowerCase().includes(lower));

  const openDoc = (node: DriveNode) => {
    const id = node.target_id ?? node.id;
    router.push(`/docs/editor?id=${id}&name=${encodeURIComponent(node.name)}`);
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Library className="h-3.5 w-3.5" />
        Bibliothèque
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[500px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Library className="h-4 w-4 text-primary" />
              Bibliothèque de contenu
            </SheetTitle>
          </SheetHeader>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-9"
            />
          </div>

          <Tabs defaultValue="docs" className="flex-1 flex flex-col mt-3 min-h-0">
            <TabsList className="grid grid-cols-4 h-8">
              <TabsTrigger value="docs" className="text-xs gap-1">
                <FileText className="h-3 w-3" />
                Docs
                <Badge variant="secondary" className="h-4 text-xs ml-0.5">{filteredDocs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="drive" className="text-xs gap-1">
                <HardDrive className="h-3 w-3" />
                Drive
                <Badge variant="secondary" className="h-4 text-xs ml-0.5">{filteredFiles.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="social" className="text-xs gap-1">
                <Share2 className="h-3 w-3" />
                Social
                <Badge variant="secondary" className="h-4 text-xs ml-0.5">{filteredPosts.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="media" className="text-xs gap-1">
                <Image className="h-3 w-3" />
                Médias
                <Badge variant="secondary" className="h-4 text-xs ml-0.5">{filteredMedia.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="docs" className="flex-1 overflow-y-auto mt-2 space-y-1">
              {loadingDrive && <p className="text-xs text-muted-foreground text-center py-4">Chargement...</p>}
              {filteredDocs.map((d) => (
                <button key={d.id} onClick={() => openDoc(d)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-accent text-sm text-left">
                  <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
              {!loadingDrive && filteredDocs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun document</p>
              )}
            </TabsContent>

            <TabsContent value="drive" className="flex-1 overflow-y-auto mt-2 space-y-1">
              {filteredFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border text-sm">
                  {f.node_type === 'folder'
                    ? <Folder className="h-4 w-4 shrink-0 text-yellow-500" />
                    : <File className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.size ? `${(f.size / 1024).toFixed(1)} Ko` : 'Taille inconnue'}
                    </p>
                  </div>
                </div>
              ))}
              {filteredFiles.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun fichier</p>
              )}
            </TabsContent>

            <TabsContent value="social" className="flex-1 overflow-y-auto mt-2 space-y-2">
              {loadingPosts && <p className="text-xs text-muted-foreground text-center py-4">Chargement...</p>}
              {filteredPosts.map((p) => (
                <div key={p.id} className="rounded-lg border p-3 text-sm space-y-1">
                  <p className="line-clamp-2 text-foreground">{p.content}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === 'published' ? 'default' : 'secondary'} className="text-xs h-4">
                      {p.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {p.publishedAt ? formatDistanceToNow(new Date(p.publishedAt), { addSuffix: true }) : ''}
                    </span>
                  </div>
                </div>
              ))}
              {!loadingPosts && filteredPosts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun post</p>
              )}
            </TabsContent>

            <TabsContent value="media" className="flex-1 overflow-y-auto mt-2">
              <div className="grid grid-cols-3 gap-2">
                {filteredMedia.map((m, i) => (
                  <a key={i} href={m.url} target="_blank" rel="noopener noreferrer"
                    className="aspect-square rounded-lg border overflow-hidden bg-muted/30 hover:opacity-80 transition-opacity">
                    <img src={m.url} alt={m.name} className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </a>
                ))}
                {filteredMedia.length === 0 && (
                  <p className="col-span-3 text-xs text-muted-foreground text-center py-4">Aucun média</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
