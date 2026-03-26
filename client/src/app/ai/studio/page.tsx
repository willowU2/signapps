'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Image, Video, AudioLines, Eye, Loader2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// PLACEHOLDER PANEL — will be replaced by real panels from Task 12.2
// ═══════════════════════════════════════════════════════════════════════════

function PlaceholderPanel({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof Image;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 mb-3 animate-spin opacity-40" />
          <p className="text-sm">Panel component loading...</p>
          <p className="text-xs mt-1 opacity-60">
            Ce panneau sera disponible dans une prochaine mise a jour.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDIO PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function StudioPage() {
  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Media Studio</h1>
        <p className="text-muted-foreground">
          Generation d&apos;images, videos, audio et analyse visuelle avec l&apos;IA
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="image" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="image" className="gap-1.5">
            <Image className="h-4 w-4" />
            Image
          </TabsTrigger>
          <TabsTrigger value="video" className="gap-1.5">
            <Video className="h-4 w-4" />
            Video
          </TabsTrigger>
          <TabsTrigger value="audio" className="gap-1.5">
            <AudioLines className="h-4 w-4" />
            Audio
          </TabsTrigger>
          <TabsTrigger value="vision" className="gap-1.5">
            <Eye className="h-4 w-4" />
            Vision
          </TabsTrigger>
        </TabsList>

        <TabsContent value="image">
          <PlaceholderPanel title="Generation d'images" icon={Image} />
        </TabsContent>

        <TabsContent value="video">
          <PlaceholderPanel title="Generation de videos" icon={Video} />
        </TabsContent>

        <TabsContent value="audio">
          <PlaceholderPanel title="Generation audio" icon={AudioLines} />
        </TabsContent>

        <TabsContent value="vision">
          <PlaceholderPanel title="Analyse visuelle" icon={Eye} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
