'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Video, AudioLines, Eye } from 'lucide-react';
import { ImageGenPanel } from '@/components/ai/image-gen-panel';
import { VideoGenPanel } from '@/components/ai/video-gen-panel';
import { AudioGenPanel } from '@/components/ai/audio-gen-panel';
import { VisionAnalyzer } from '@/components/ai/vision-analyzer';

// ═══════════════════════════════════════════════════════════════════════════
// STUDIO PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function StudioPage() {
  return (
    <div className="w-full py-6 space-y-6">
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
          <ImageGenPanel />
        </TabsContent>

        <TabsContent value="video">
          <VideoGenPanel />
        </TabsContent>

        <TabsContent value="audio">
          <AudioGenPanel />
        </TabsContent>

        <TabsContent value="vision">
          <VisionAnalyzer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
