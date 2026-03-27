'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Video,
  Loader2,
  Download,
  Sparkles,
  Upload,
  ImageIcon,
  Search,
  FileText,
  X,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useAiVideo } from '@/hooks/use-ai-video';

// ─── Presets ─────────────────────────────────────────────────────────────────

const RESOLUTION_PRESETS = [
  { label: '512x512', w: 512, h: 512 },
  { label: '768x432', w: 768, h: 432 },
  { label: '1024x576', w: 1024, h: 576 },
  { label: '1280x720', w: 1280, h: 720 },
] as const;

const FPS_OPTIONS = [24, 30] as const;

// ─── File drop helper ────────────────────────────────────────────────────────

function FileDropZone({
  accept,
  label,
  file,
  onFile,
}: {
  accept: string;
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
        ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Video className="h-4 w-4 text-primary" />
          <span className="truncate max-w-[200px]">{file.name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VideoGenPanel() {
  const {
    generating,
    analyzing,
    result,
    analysis,
    transcript,
    error,
    models,
    generateVideo,
    imgToVideo,
    analyzeVideo,
    transcribeVideo,
    fetchModels,
    reset,
  } = useAiVideo();

  // --- Generate tab ---
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [duration, setDuration] = useState(10);
  const [fps, setFps] = useState<number>(24);
  const [resW, setResW] = useState(1024);
  const [resH, setResH] = useState(576);
  const [model, setModel] = useState('');

  // --- Img-to-Video tab ---
  const [i2vImage, setI2vImage] = useState<File | null>(null);
  const [i2vPrompt, setI2vPrompt] = useState('');
  const [i2vDuration, setI2vDuration] = useState(5);

  // --- Analyze tab ---
  const [analyzeFile, setAnalyzeFile] = useState<File | null>(null);
  const [analyzePrompt, setAnalyzePrompt] = useState('');

  // --- Transcribe tab ---
  const [transcribeFile, setTranscribeFile] = useState<File | null>(null);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const busy = generating || analyzing;

  // --- Handlers ---

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) {
      toast.error('Veuillez saisir un prompt');
      return;
    }
    generateVideo({
      prompt: prompt.trim(),
      negative_prompt: negativePrompt.trim() || undefined,
      width: resW,
      height: resH,
      duration,
      fps,
      model: model || undefined,
    });
  }, [prompt, negativePrompt, resW, resH, duration, fps, model, generateVideo]);

  const handleI2V = useCallback(() => {
    if (!i2vImage) {
      toast.error('Veuillez fournir une image');
      return;
    }
    imgToVideo(i2vImage, i2vPrompt.trim() || undefined, i2vDuration);
  }, [i2vImage, i2vPrompt, i2vDuration, imgToVideo]);

  const handleAnalyze = useCallback(() => {
    if (!analyzeFile) {
      toast.error('Veuillez fournir une vidéo');
      return;
    }
    analyzeVideo(analyzeFile, analyzePrompt.trim() || undefined);
  }, [analyzeFile, analyzePrompt, analyzeVideo]);

  const handleTranscribe = useCallback(() => {
    if (!transcribeFile) {
      toast.error('Veuillez fournir une vidéo');
      return;
    }
    transcribeVideo(transcribeFile);
  }, [transcribeFile, transcribeVideo]);

  const handleDownload = useCallback(() => {
    if (!result?.video_url) return;
    const a = document.createElement('a');
    a.href = result.video_url;
    a.download = `generated-${Date.now()}.mp4`;
    a.click();
  }, [result]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Video className="h-5 w-5 text-blue-500" />
          Vidéo IA
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Générez, analysez et transcrivez des vidéos avec l&apos;IA.
        </p>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="generate" className="flex-1">
              <Sparkles className="h-4 w-4 mr-1" />
              Générer
            </TabsTrigger>
            <TabsTrigger value="img2video" className="flex-1">
              <ImageIcon className="h-4 w-4 mr-1" />
              Img2Vidéo
            </TabsTrigger>
            <TabsTrigger value="analyze" className="flex-1">
              <Search className="h-4 w-4 mr-1" />
              Analyser
            </TabsTrigger>
            <TabsTrigger value="transcribe" className="flex-1">
              <FileText className="h-4 w-4 mr-1" />
              Transcrire
            </TabsTrigger>
          </TabsList>

          {/* ════════════════ GENERATE TAB ════════════════ */}
          <TabsContent value="generate" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="vid-prompt">Prompt</Label>
              <Textarea
                id="vid-prompt"
                placeholder="Décrivez la vidéo que vous souhaitez générer..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                disabled={busy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vid-neg">Prompt négatif (optionnel)</Label>
              <Input
                id="vid-neg"
                placeholder="Éléments à exclure..."
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                disabled={busy}
              />
            </div>

            <Separator />

            {/* Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Durée</Label>
                <span className="text-xs text-muted-foreground">{duration}s</span>
              </div>
              <Slider
                min={2}
                max={60}
                step={1}
                value={[duration]}
                onValueChange={([v]) => setDuration(v)}
                disabled={busy}
              />
            </div>

            {/* FPS */}
            <div className="space-y-2">
              <Label>Images par seconde</Label>
              <div className="flex gap-2">
                {FPS_OPTIONS.map((f) => (
                  <Button
                    key={f}
                    variant={fps === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFps(f)}
                    disabled={busy}
                  >
                    {f} fps
                  </Button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <Label>Résolution</Label>
              <div className="flex flex-wrap gap-2">
                {RESOLUTION_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant={resW === p.w && resH === p.h ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setResW(p.w);
                      setResH(p.h);
                    }}
                    disabled={busy}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Model */}
            {models.length > 0 && (
              <div className="space-y-2">
                <Label>Modèle</Label>
                <Select value={model} onValueChange={setModel} disabled={busy}>
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
              onClick={handleGenerate}
              disabled={busy || !prompt.trim()}
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
                  Générer la vidéo
                </>
              )}
            </Button>
          </TabsContent>

          {/* ════════════════ IMG2VIDEO TAB ════════════════ */}
          <TabsContent value="img2video" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Image source</Label>
              <FileDropZone
                accept="image/*"
                label="Glissez ou cliquez pour importer une image"
                file={i2vImage}
                onFile={setI2vImage}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="i2v-prompt">Prompt (optionnel)</Label>
              <Textarea
                id="i2v-prompt"
                placeholder="Décrivez le mouvement ou l'animation souhaitée..."
                value={i2vPrompt}
                onChange={(e) => setI2vPrompt(e.target.value)}
                rows={2}
                disabled={busy}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Durée</Label>
                <span className="text-xs text-muted-foreground">{i2vDuration}s</span>
              </div>
              <Slider
                min={2}
                max={30}
                step={1}
                value={[i2vDuration]}
                onValueChange={([v]) => setI2vDuration(v)}
                disabled={busy}
              />
            </div>

            <Button
              onClick={handleI2V}
              disabled={busy || !i2vImage}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conversion en cours...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Convertir en vidéo
                </>
              )}
            </Button>
          </TabsContent>

          {/* ════════════════ ANALYZE TAB ════════════════ */}
          <TabsContent value="analyze" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Vidéo à analyser</Label>
              <FileDropZone
                accept="video/*"
                label="Glissez ou cliquez pour importer une vidéo"
                file={analyzeFile}
                onFile={setAnalyzeFile}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="analyze-prompt">Question (optionnel)</Label>
              <Input
                id="analyze-prompt"
                placeholder="Que souhaitez-vous savoir sur cette vidéo ?"
                value={analyzePrompt}
                onChange={(e) => setAnalyzePrompt(e.target.value)}
                disabled={busy}
              />
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={busy || !analyzeFile}
              className="w-full"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Analyser la vidéo
                </>
              )}
            </Button>

            {/* Analysis results */}
            {analysis && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Résultat de l&apos;analyse</h3>
                  <p className="text-sm">{analysis.description}</p>

                  {analysis.tags && analysis.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {analysis.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {analysis.scenes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                        Scènes détectées
                      </h4>
                      <div className="space-y-1">
                        {analysis.scenes.map((scene, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50"
                          >
                            <Clock className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                            <div>
                              <span className="font-mono text-muted-foreground">
                                {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                              </span>
                              <p className="mt-0.5">{scene.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* ════════════════ TRANSCRIBE TAB ════════════════ */}
          <TabsContent value="transcribe" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Vidéo à transcrire</Label>
              <FileDropZone
                accept="video/*"
                label="Glissez ou cliquez pour importer une vidéo"
                file={transcribeFile}
                onFile={setTranscribeFile}
              />
            </div>

            <Button
              onClick={handleTranscribe}
              disabled={busy || !transcribeFile}
              className="w-full"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transcription en cours...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Transcrire la vidéo
                </>
              )}
            </Button>

            {/* Transcript results */}
            {transcript && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Transcription</h3>

                  {transcript.segments.length > 0 ? (
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {transcript.segments.map((seg, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50"
                        >
                          <span className="font-mono text-muted-foreground shrink-0 w-24">
                            {formatTime(seg.start)} - {formatTime(seg.end)}
                          </span>
                          <p>{seg.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm">{transcript.text}</p>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* ════════════════ VIDEO RESULT ════════════════ */}
        {result && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Résultat
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {result.width}x{result.height}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {result.duration}s
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {result.model_used}
                  </Badge>
                </div>
              </div>

              <video
                src={result.video_url}
                controls
                className="w-full rounded-lg border shadow-sm"
              />

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
