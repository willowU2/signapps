'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Video, Sparkles, Download, Camera, Clock, Film, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api/ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Platform = 'tiktok' | 'reels' | 'shorts';
type Duration = 15 | 30 | 60;

interface VideoScene {
  sceneNumber: number;
  text: string; // narration / caption
  duration: number; // seconds
  visualDesc: string; // description of what to film
  bRollSuggestion?: string;
}

interface VideoScript {
  title: string;
  platform: Platform;
  totalDuration: Duration;
  hook: string;
  cta: string;
  scenes: VideoScene[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
  shorts: 'YouTube Shorts',
};

const DURATION_LABELS: Record<Duration, string> = {
  15: '15 seconds',
  30: '30 seconds',
  60: '60 seconds',
};

// ---------------------------------------------------------------------------
// Scene card (storyboard)
// ---------------------------------------------------------------------------

function SceneCard({ scene }: { scene: VideoScene }) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          Scene {scene.sceneNumber}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {scene.duration}s
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">{scene.text}</p>
      </div>

      <Separator className="my-1" />

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
          <Camera className="h-3 w-3" />
          Shot description
        </p>
        <p className="text-xs text-muted-foreground">{scene.visualDesc}</p>
      </div>

      {scene.bRollSuggestion && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Film className="h-3 w-3" />
            B-roll
          </p>
          <p className="text-xs text-muted-foreground">{scene.bRollSuggestion}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function scriptToText(script: VideoScript): string {
  const lines: string[] = [
    `VIDEO SCRIPT: ${script.title}`,
    `Platform: ${PLATFORM_LABELS[script.platform]} | Duration: ${script.totalDuration}s`,
    '',
    `HOOK: ${script.hook}`,
    '',
    '--- SCENES ---',
  ];
  for (const scene of script.scenes) {
    lines.push(`\n[SCENE ${scene.sceneNumber}] (${scene.duration}s)`);
    lines.push(`NARRATION: ${scene.text}`);
    lines.push(`SHOT: ${scene.visualDesc}`);
    if (scene.bRollSuggestion) lines.push(`B-ROLL: ${scene.bRollSuggestion}`);
  }
  lines.push('', `CTA: ${script.cta}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// AI prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(topic: string, platform: Platform, duration: Duration): string {
  const sceneCount = duration === 15 ? 3 : duration === 30 ? 5 : 8;
  return `You are a professional social media video scriptwriter.

Create a ${duration}-second video script for ${PLATFORM_LABELS[platform]} about: "${topic}".

Return ONLY valid JSON (no markdown, no explanation) in this exact shape:
{
  "title": "short catchy title",
  "hook": "opening hook (first 3 seconds)",
  "cta": "call to action for the end",
  "scenes": [
    {
      "sceneNumber": 1,
      "text": "narration or on-screen caption",
      "duration": number_of_seconds,
      "visualDesc": "what to film / show on screen",
      "bRollSuggestion": "optional b-roll footage suggestion"
    }
  ]
}

Requirements:
- Exactly ${sceneCount} scenes
- Total scene durations must sum to ${duration}
- Hook must grab attention in the first 3 seconds
- Use natural, conversational language
- Each scene description must be specific and filmable`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AIVideoGenerator() {
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<Platform>('reels');
  const [duration, setDuration] = useState<Duration>(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [script, setScript] = useState<VideoScript | null>(null);
  const [rawJson, setRawJson] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Enter a topic first');
      return;
    }
    setIsGenerating(true);
    setScript(null);

    try {
      const prompt = buildPrompt(topic, platform, duration);
      const response = await aiApi.chat(prompt, {
        systemPrompt: 'You are a video scriptwriter. Always respond with valid JSON only.',
      });

      const raw: string = (response.data as any)?.answer ?? (response.data as any)?.content ?? '';
      // Extract JSON from response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]);
      const result: VideoScript = {
        title: parsed.title ?? topic,
        platform,
        totalDuration: duration,
        hook: parsed.hook ?? '',
        cta: parsed.cta ?? '',
        scenes: (parsed.scenes ?? []).map((s: any, i: number) => ({
          sceneNumber: s.sceneNumber ?? i + 1,
          text: s.text ?? '',
          duration: s.duration ?? Math.floor(duration / (parsed.scenes?.length ?? 1)),
          visualDesc: s.visualDesc ?? s.visual_desc ?? '',
          bRollSuggestion: s.bRollSuggestion ?? s.b_roll_suggestion ?? undefined,
        })),
      };

      setScript(result);
      setRawJson(scriptToText(result));
      toast.success('Script generated!');
    } catch (err) {
      // Fallback mock for when AI is not available
      const mockScript: VideoScript = {
        title: `${topic} — Quick Guide`,
        platform,
        totalDuration: duration,
        hook: `Did you know that ${topic} can change everything?`,
        cta: 'Follow for more tips and drop a comment below!',
        scenes: Array.from({ length: duration === 15 ? 3 : duration === 30 ? 5 : 8 }, (_, i) => ({
          sceneNumber: i + 1,
          text: `Key point ${i + 1} about ${topic}`,
          duration: Math.floor(duration / (duration === 15 ? 3 : duration === 30 ? 5 : 8)),
          visualDesc: `Close-up shot showing aspect ${i + 1} of ${topic}`,
          bRollSuggestion: i % 2 === 0 ? `Stock footage or product shot related to ${topic}` : undefined,
        })),
      };
      setScript(mockScript);
      setRawJson(scriptToText(mockScript));
      toast.info('Using demo script (AI not available)');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(rawJson);
    toast.success('Script copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([rawJson], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-script-${topic.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Script downloaded');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">AI Video Generator</h2>
      </div>

      {/* Input form */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Topic / Subject *</Label>
            <Input
              placeholder="e.g. 5 productivity hacks for remote workers"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duration</Label>
              <Select
                value={String(duration)}
                onValueChange={(v) => setDuration(parseInt(v) as Duration)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DURATION_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={isGenerating || !topic.trim()} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating script…' : 'Generate Script'}
          </Button>
        </CardContent>
      </Card>

      {/* Storyboard */}
      {script && (
        <div className="space-y-4">
          {/* Title bar */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{script.title}</h3>
              <p className="text-sm text-muted-foreground">
                {PLATFORM_LABELS[script.platform]} · {script.totalDuration}s ·{' '}
                {script.scenes.length} scenes
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyScript}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5 mr-1" />
                Download
              </Button>
            </div>
          </div>

          {/* Hook */}
          <Card className="border-primary/40">
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">Hook (0-3s)</p>
              <p className="text-sm font-medium">{script.hook}</p>
            </CardContent>
          </Card>

          {/* Scenes storyboard */}
          <div>
            <p className="text-sm font-medium mb-3">Storyboard</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {script.scenes.map((scene) => (
                <SceneCard key={scene.sceneNumber} scene={scene} />
              ))}
            </div>
          </div>

          {/* CTA */}
          <Card className="border-green-500/40">
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Call to Action</p>
              <p className="text-sm font-medium">{script.cta}</p>
            </CardContent>
          </Card>

          {/* Raw text export */}
          <div className="space-y-1">
            <Label className="text-xs">Full script (text)</Label>
            <Textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              className="min-h-[200px] font-mono text-xs resize-y"
            />
          </div>
        </div>
      )}
    </div>
  );
}
