'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Music,
  Loader2,
  Download,
  Sparkles,
  Volume2,
  Waves,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAiAudioGen } from '@/hooks/use-ai-audio-gen';

// ─── Component ───────────────────────────────────────────────────────────────

export function AudioGenPanel() {
  const {
    generating,
    result,
    error,
    models,
    generateMusic,
    generateSfx,
    fetchModels,
    reset,
  } = useAiAudioGen();

  // --- Music tab ---
  const [musicPrompt, setMusicPrompt] = useState('');
  const [musicDuration, setMusicDuration] = useState(30);
  const [musicTemperature, setMusicTemperature] = useState(1.0);
  const [musicModel, setMusicModel] = useState('');

  // --- SFX tab ---
  const [sfxPrompt, setSfxPrompt] = useState('');
  const [sfxDuration, setSfxDuration] = useState(5);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // --- Handlers ---

  const handleGenerateMusic = useCallback(() => {
    if (!musicPrompt.trim()) {
      toast.error('Veuillez saisir un prompt');
      return;
    }
    generateMusic({
      prompt: musicPrompt.trim(),
      duration: musicDuration,
      temperature: musicTemperature,
      model: musicModel || undefined,
    });
  }, [musicPrompt, musicDuration, musicTemperature, musicModel, generateMusic]);

  const handleGenerateSfx = useCallback(() => {
    if (!sfxPrompt.trim()) {
      toast.error('Veuillez saisir un prompt');
      return;
    }
    generateSfx({
      prompt: sfxPrompt.trim(),
      duration: sfxDuration,
    });
  }, [sfxPrompt, sfxDuration, generateSfx]);

  const handleDownload = useCallback(() => {
    if (!result?.audio_url) return;
    const a = document.createElement('a');
    a.href = result.audio_url;
    a.download = `audio-${Date.now()}.wav`;
    a.click();
  }, [result]);

  function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m === 0) return `${s}s`;
    return `${m}m${s > 0 ? ` ${s}s` : ''}`;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Music className="h-5 w-5 text-green-500" />
          Génération audio
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Créez de la musique et des effets sonores avec l&apos;IA.
        </p>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="music" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="music" className="flex-1">
              <Music className="h-4 w-4 mr-1" />
              Musique
            </TabsTrigger>
            <TabsTrigger value="sfx" className="flex-1">
              <Volume2 className="h-4 w-4 mr-1" />
              Effets sonores
            </TabsTrigger>
          </TabsList>

          {/* ════════════════ MUSIC TAB ════════════════ */}
          <TabsContent value="music" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="music-prompt">Prompt</Label>
              <Textarea
                id="music-prompt"
                placeholder="Décrivez la musique souhaitée (genre, ambiance, instruments, tempo...)..."
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                rows={3}
                disabled={generating}
              />
            </div>

            <Separator />

            {/* Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Durée</Label>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(musicDuration)}
                </span>
              </div>
              <Slider
                min={5}
                max={120}
                step={5}
                value={[musicDuration]}
                onValueChange={([v]) => setMusicDuration(v)}
                disabled={generating}
              />
              <p className="text-xs text-muted-foreground">
                5 secondes à 2 minutes
              </p>
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Température (créativité)</Label>
                <span className="text-xs text-muted-foreground">
                  {musicTemperature.toFixed(1)}
                </span>
              </div>
              <Slider
                min={0.1}
                max={2.0}
                step={0.1}
                value={[musicTemperature]}
                onValueChange={([v]) => setMusicTemperature(v)}
                disabled={generating}
              />
              <p className="text-xs text-muted-foreground">
                Bas = conservateur, Haut = créatif
              </p>
            </div>

            {/* Model */}
            {models.length > 0 && (
              <div className="space-y-2">
                <Label>Modèle</Label>
                <Select
                  value={musicModel}
                  onValueChange={setMusicModel}
                  disabled={generating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Modèle par défaut" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleGenerateMusic}
              disabled={generating || !musicPrompt.trim()}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Générer la musique
                </>
              )}
            </Button>
          </TabsContent>

          {/* ════════════════ SFX TAB ════════════════ */}
          <TabsContent value="sfx" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="sfx-prompt">Prompt</Label>
              <Textarea
                id="sfx-prompt"
                placeholder="Décrivez l'effet sonore souhaité (explosion, pluie, pas, cloche...)..."
                value={sfxPrompt}
                onChange={(e) => setSfxPrompt(e.target.value)}
                rows={3}
                disabled={generating}
              />
            </div>

            <Separator />

            {/* Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Durée</Label>
                <span className="text-xs text-muted-foreground">{sfxDuration}s</span>
              </div>
              <Slider
                min={1}
                max={30}
                step={1}
                value={[sfxDuration]}
                onValueChange={([v]) => setSfxDuration(v)}
                disabled={generating}
              />
              <p className="text-xs text-muted-foreground">
                1 à 30 secondes
              </p>
            </div>

            <Button
              onClick={handleGenerateSfx}
              disabled={generating || !sfxPrompt.trim()}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Générer l&apos;effet sonore
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {/* ════════════════ AUDIO RESULT ════════════════ */}
        {result && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Waves className="h-4 w-4" />
                  Résultat
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {formatDuration(result.duration)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {result.sample_rate} Hz
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {result.model_used}
                  </Badge>
                </div>
              </div>

              {/* Audio player */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <audio
                  src={result.audio_url}
                  controls
                  className="w-full"
                />
              </div>

              {/* Simple waveform visualization placeholder */}
              <div className="flex items-center justify-center gap-[2px] h-12 px-2">
                {Array.from({ length: 60 }).map((_, i) => {
                  const h = 20 + Math.sin(i * 0.5) * 15 + Math.random() * 10;
                  return (
                    <div
                      key={i}
                      className="bg-primary/40 rounded-full w-1 transition-all"
                      style={{ height: `${Math.max(4, h)}%` }}
                    />
                  );
                })}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => reset()}>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Nouveau
                </Button>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Télécharger
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
