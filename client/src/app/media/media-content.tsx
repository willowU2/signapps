'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  ScanText,
  Volume2,
  Mic,
  Upload,
  FileText,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  RefreshCw,
  FileAudio,
  Languages,
  BookOpen,
  ImageIcon,
  Layers,
  Grid3X3,
  Camera,
  Film,
  FolderOpen,
} from 'lucide-react';
import { VideoPlayerWithChapters } from '@/components/media/video-player-chapters';
import { ImageEditor } from '@/components/media/image-editor';
import { BatchMediaProcessor } from '@/components/media/batch-media-processor';
import { PhotoGalleryLightbox } from '@/components/media/photo-gallery-lightbox';
import { ExifViewer } from '@/components/media/exif-viewer';
import { VideoThumbnailGenerator } from '@/components/media/video-thumbnail';
import { SharedAlbums } from '@/components/media/shared-albums';
import {
  ocrApi,
  ttsApi,
  sttApi,
  type OcrResponse,
  type TranscribeResponse,
  type Voice,
  type SttModel,
} from '@/lib/api/media';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── OCR Tab ──────────────────────────────────────────────────────────────────

function OcrTab() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResponse | null>(null);
  const [mode, setMode] = useState<'image' | 'document'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile],
  );

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fn = mode === 'document' ? ocrApi.processDocument : ocrApi.extractText;
      const res = await fn(file, { detect_layout: true, detect_tables: true });
      setResult(res.data);
      toast.success('Text extracted successfully');
    } catch {
      toast.error('OCR failed — check the file format and try again');
    } finally {
      setLoading(false);
    }
  };

  const copyText = () => {
    if (!result?.text) return;
    navigator.clipboard.writeText(result.text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: upload + options */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Source File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode selector */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === 'image' ? 'default' : 'outline'}
                onClick={() => setMode('image')}
                className="flex-1"
              >
                Image
              </Button>
              <Button
                size="sm"
                variant={mode === 'document' ? 'default' : 'outline'}
                onClick={() => setMode('document')}
                className="flex-1"
              >
                Document
              </Button>
            </div>

            {/* Drop zone */}
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                'hover:border-primary hover:bg-primary/5',
                file ? 'border-primary/60 bg-primary/5' : 'border-muted-foreground/30',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={mode === 'document' ? '.pdf,.docx,.doc,.odt,.txt' : 'image/*'}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="space-y-1">
                  <FileText className="h-8 w-8 mx-auto text-primary" />
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop a file here or <span className="text-primary font-medium">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mode === 'document' ? 'PDF, DOCX, ODT, TXT' : 'PNG, JPG, TIFF, WEBP'}
                  </p>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!file || loading}
              onClick={handleExtract}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting…
                </>
              ) : (
                <>
                  <ScanText className="h-4 w-4 mr-2" />
                  Extract Text
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Metadata */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Extraction Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd className="font-medium">{result.metadata.provider}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Pages</dt>
                  <dd className="font-medium">{result.metadata.total_pages}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Confidence</dt>
                  <dd className="font-medium">{(result.confidence * 100).toFixed(1)}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Processing time</dt>
                  <dd className="font-medium">{result.metadata.processing_time_ms} ms</dd>
                </div>
                {result.metadata.detected_languages.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Languages</dt>
                    <dd className="flex gap-1 flex-wrap justify-end">
                      {result.metadata.detected_languages.map((l) => (
                        <Badge key={l} variant="secondary" className="text-xs">
                          {l}
                        </Badge>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: result */}
      <Card className="flex flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Extracted Text</CardTitle>
          {result?.text && (
            <Button size="sm" variant="outline" onClick={copyText}>
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : result ? (
            <div className="space-y-4">
              {result.pages.length > 1 ? (
                result.pages.map((page) => (
                  <div key={page.page_number}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Page {page.page_number} — {page.blocks_count} blocks
                      {page.tables_count > 0 && `, ${page.tables_count} tables`}
                    </p>
                    <pre className="text-sm whitespace-pre-wrap font-sans text-foreground bg-muted/30 rounded-lg p-3">
                      {page.text}
                    </pre>
                  </div>
                ))
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-sans text-foreground bg-muted/30 rounded-lg p-4 min-h-[200px]">
                  {result.text || <span className="text-muted-foreground italic">No text found</span>}
                </pre>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <ScanText className="h-10 w-10 opacity-30" />
              <p className="text-sm">Upload a file and click Extract Text</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── TTS Tab ──────────────────────────────────────────────────────────────────

function TtsTab() {
  const [text, setText] = useState('');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [format, setFormat] = useState<'wav' | 'mp3' | 'ogg' | 'flac'>('mp3');
  const [loading, setLoading] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setLoadingVoices(true);
    ttsApi
      .listVoices()
      .then((res) => {
        setVoices(res.data);
        if (res.data.length > 0) setSelectedVoice(res.data[0].id);
      })
      .catch(() => toast.error('Could not load voices'))
      .finally(() => setLoadingVoices(false));
  }, []);

  // Revoke previous object URL on change
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleSynthesize = async () => {
    if (!text.trim()) return;
    setLoading(true);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const res = await ttsApi.synthesize(text, {
        voice: selectedVoice || undefined,
        format,
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      toast.success('Audio synthesized');
    } catch {
      toast.error('Synthesis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts-output.${format}`;
    a.click();
  };

  const selectedVoiceInfo = voices.find((v) => v.id === selectedVoice);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: input + options */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Text Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Enter the text you want to convert to speech…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[160px] resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {text.length} characters
            </p>

            {/* Voice selector */}
            <div className="space-y-1.5">
              <Label>Voice</Label>
              {loadingVoices ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a voice…" />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No voices available
                      </SelectItem>
                    ) : (
                      voices.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                          {v.language && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {v.language}
                            </span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Format selector */}
            <div className="space-y-1.5">
              <Label>Output Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as typeof format)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3</SelectItem>
                  <SelectItem value="wav">WAV</SelectItem>
                  <SelectItem value="ogg">OGG</SelectItem>
                  <SelectItem value="flac">FLAC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              disabled={!text.trim() || loading}
              onClick={handleSynthesize}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Synthesizing…
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Synthesize
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right: result */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              Audio Output
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedVoiceInfo && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{selectedVoiceInfo.name}</Badge>
                {selectedVoiceInfo.language && (
                  <Badge variant="outline">{selectedVoiceInfo.language}</Badge>
                )}
                {selectedVoiceInfo.gender && (
                  <Badge variant="outline">{selectedVoiceInfo.gender}</Badge>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Synthesizing audio…</p>
              </div>
            ) : audioUrl ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Audio ready
                </div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  className="w-full"
                />
                <Button variant="outline" size="sm" onClick={handleDownload} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download .{format}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <Volume2 className="h-10 w-10 opacity-30" />
                <p className="text-sm">Audio will appear here after synthesis</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Description card */}
        {selectedVoiceInfo?.description && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{selectedVoiceInfo.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── STT Tab ──────────────────────────────────────────────────────────────────

function SttTab() {
  const [file, setFile] = useState<File | null>(null);
  const [models, setModels] = useState<SttModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [language, setLanguage] = useState('');
  const [task, setTask] = useState<'transcribe' | 'translate'>('transcribe');
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [result, setResult] = useState<TranscribeResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoadingModels(true);
    sttApi
      .listModels()
      .then((res) => {
        setModels(res.data);
        if (res.data.length > 0) setSelectedModel(res.data[0].id);
      })
      .catch(() => toast.error('Could not load STT models'))
      .finally(() => setLoadingModels(false));
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile],
  );

  const handleTranscribe = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await sttApi.transcribe(file, {
        model: selectedModel || undefined,
        language: language || undefined,
        task,
        word_timestamps: true,
      });
      setResult(res.data);
      toast.success('Transcription complete');
    } catch {
      toast.error('Transcription failed');
    } finally {
      setLoading(false);
    }
  };

  const copyText = () => {
    if (!result?.text) return;
    navigator.clipboard.writeText(result.text);
    toast.success('Copied to clipboard');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: upload + options */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileAudio className="h-4 w-4 text-primary" />
              Audio File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                'hover:border-primary hover:bg-primary/5',
                file ? 'border-primary/60 bg-primary/5' : 'border-muted-foreground/30',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.webm"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="space-y-1">
                  <FileAudio className="h-8 w-8 mx-auto text-primary" />
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Mic className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop an audio file or <span className="text-primary font-medium">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground">MP3, WAV, OGG, FLAC, M4A</p>
                </div>
              )}
            </div>

            {/* Model selector */}
            <div className="space-y-1.5">
              <Label>Model</Label>
              {loadingModels ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model…" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        No models available
                      </SelectItem>
                    ) : (
                      models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          {m.size && (
                            <span className="text-muted-foreground ml-2 text-xs">{m.size}</span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Task selector */}
            <div className="space-y-1.5">
              <Label>Task</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={task === 'transcribe' ? 'default' : 'outline'}
                  onClick={() => setTask('transcribe')}
                  className="flex-1"
                >
                  Transcribe
                </Button>
                <Button
                  size="sm"
                  variant={task === 'translate' ? 'default' : 'outline'}
                  onClick={() => setTask('translate')}
                  className="flex-1"
                >
                  Translate to EN
                </Button>
              </div>
            </div>

            {/* Language hint */}
            <div className="space-y-1.5">
              <Label>
                Language hint{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="e.g. fr, en, es…"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={!file || loading}
              onClick={handleTranscribe}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transcribing…
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Transcribe
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right: result */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Transcript</CardTitle>
            {result?.text && (
              <Button size="sm" variant="outline" onClick={copyText}>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : result ? (
              <div className="space-y-4">
                {/* Stats row */}
                <div className="flex flex-wrap gap-2">
                  {result.language && (
                    <Badge variant="secondary" className="gap-1">
                      <Languages className="h-3 w-3" />
                      {result.language}
                      {result.language_probability > 0 && (
                        <span className="text-muted-foreground ml-1">
                          {(result.language_probability * 100).toFixed(0)}%
                        </span>
                      )}
                    </Badge>
                  )}
                  {result.duration_seconds > 0 && (
                    <Badge variant="outline">
                      {formatTime(result.duration_seconds)} duration
                    </Badge>
                  )}
                  {result.model_used && (
                    <Badge variant="outline">{result.model_used}</Badge>
                  )}
                  <Badge variant="outline">{result.processing_time_ms} ms</Badge>
                </div>

                {/* Full text */}
                <pre className="text-sm whitespace-pre-wrap font-sans text-foreground bg-muted/30 rounded-lg p-4 min-h-[120px]">
                  {result.text || (
                    <span className="text-muted-foreground italic">No speech detected</span>
                  )}
                </pre>

                {/* Segments */}
                {result.segments.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Segments ({result.segments.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-2">
                      {result.segments.map((seg) => (
                        <div
                          key={seg.id}
                          className="flex gap-3 text-sm py-1 border-b last:border-0 border-border/50"
                        >
                          <span className="shrink-0 text-xs text-muted-foreground pt-0.5 w-20">
                            {formatTime(seg.start)} → {formatTime(seg.end)}
                          </span>
                          <span className="text-foreground">
                            {seg.speaker && (
                              <Badge variant="outline" className="text-xs mr-1 py-0">
                                {seg.speaker}
                              </Badge>
                            )}
                            {seg.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                <Mic className="h-10 w-10 opacity-30" />
                <p className="text-sm">Upload an audio file and click Transcribe</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MediaContent() {
  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Media Tools</h1>
          <p className="text-muted-foreground mt-1">
            OCR, TTS, STT, video/image editing, gallery, EXIF metadata and more
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ocr" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="ocr" className="gap-1.5">
              <ScanText className="h-4 w-4" />OCR
            </TabsTrigger>
            <TabsTrigger value="tts" className="gap-1.5">
              <Volume2 className="h-4 w-4" />TTS
            </TabsTrigger>
            <TabsTrigger value="stt" className="gap-1.5">
              <Mic className="h-4 w-4" />STT
            </TabsTrigger>
            <TabsTrigger value="video" className="gap-1.5">
              <BookOpen className="h-4 w-4" />Video Chapters
            </TabsTrigger>
            <TabsTrigger value="editor" className="gap-1.5">
              <ImageIcon className="h-4 w-4" />Image Editor
            </TabsTrigger>
            <TabsTrigger value="batch" className="gap-1.5">
              <Layers className="h-4 w-4" />Batch
            </TabsTrigger>
            <TabsTrigger value="gallery" className="gap-1.5">
              <Grid3X3 className="h-4 w-4" />Gallery
            </TabsTrigger>
            <TabsTrigger value="exif" className="gap-1.5">
              <Camera className="h-4 w-4" />EXIF
            </TabsTrigger>
            <TabsTrigger value="thumbnail" className="gap-1.5">
              <Film className="h-4 w-4" />Thumbnail
            </TabsTrigger>
            <TabsTrigger value="albums" className="gap-1.5">
              <FolderOpen className="h-4 w-4" />Albums
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ocr"><OcrTab /></TabsContent>
          <TabsContent value="tts"><TtsTab /></TabsContent>
          <TabsContent value="stt"><SttTab /></TabsContent>
          <TabsContent value="video"><VideoPlayerWithChapters /></TabsContent>
          <TabsContent value="editor"><ImageEditor /></TabsContent>
          <TabsContent value="batch"><BatchMediaProcessor /></TabsContent>
          <TabsContent value="gallery"><PhotoGalleryLightbox /></TabsContent>
          <TabsContent value="exif"><ExifViewer /></TabsContent>
          <TabsContent value="thumbnail"><VideoThumbnailGenerator /></TabsContent>
          <TabsContent value="albums"><SharedAlbums /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
