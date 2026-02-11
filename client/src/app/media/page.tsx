'use client';

import { useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Mic,
  Volume2,
  Upload,
  Loader2,
  Download,
  Copy,
  Play,
  Pause,
  FileImage,
  FileVideo,
  FileAudio,
  Languages,
  Clock,
  Users,
} from 'lucide-react';
import { ocrApi, ttsApi, sttApi, OcrResponse, TranscribeResponse, Voice } from '@/lib/api';
import { toast } from 'sonner';

export default function MediaPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Media Processing</h1>
        </div>

        <Tabs defaultValue="ocr" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ocr" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              OCR
            </TabsTrigger>
            <TabsTrigger value="stt" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Speech to Text
            </TabsTrigger>
            <TabsTrigger value="tts" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Text to Speech
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ocr">
            <OcrTab />
          </TabsContent>

          <TabsContent value="stt">
            <SttTab />
          </TabsContent>

          <TabsContent value="tts">
            <TtsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function OcrTab() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<OcrResponse | null>(null);
  const [languages, setLanguages] = useState('');
  const [detectLayout, setDetectLayout] = useState(true);
  const [detectTables, setDetectTables] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;

    setProcessing(true);
    try {
      const response = await ocrApi.extractText(file, {
        languages: languages || undefined,
        detect_layout: detectLayout,
        detect_tables: detectTables,
      });
      setResult(response.data);
      toast.success('OCR completed successfully');
    } catch (error) {
      console.error('OCR failed:', error);
      toast.error('OCR processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text);
      toast.success('Text copied to clipboard');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Upload Image or Document
          </CardTitle>
          <CardDescription>
            Extract text from images, PDFs, and scanned documents using AI-powered OCR
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="space-y-2">
                <FileText className="h-12 w-12 mx-auto text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-muted-foreground">
                  PNG, JPG, PDF up to 50MB
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Languages (optional)</Label>
              <Input
                placeholder="en,fr,de (comma-separated)"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="detect-layout">Detect Layout</Label>
              <Switch
                id="detect-layout"
                checked={detectLayout}
                onCheckedChange={setDetectLayout}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="detect-tables">Detect Tables</Label>
              <Switch
                id="detect-tables"
                checked={detectTables}
                onCheckedChange={setDetectTables}
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleProcess}
            disabled={!file || processing}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Extract Text
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Extracted Text</span>
            {result && (
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">
                  Confidence: {(result.confidence * 100).toFixed(1)}%
                </Badge>
                <Badge variant="secondary">
                  Pages: {result.metadata.total_pages}
                </Badge>
                <Badge variant="secondary">
                  {result.metadata.processing_time_ms}ms
                </Badge>
                {result.metadata.detected_languages.map((lang) => (
                  <Badge key={lang} variant="outline">
                    {lang}
                  </Badge>
                ))}
              </div>
              <Textarea
                value={result.text}
                readOnly
                className="min-h-[400px] font-mono text-sm"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              Upload an image to extract text
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SttTab() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<TranscribeResponse | null>(null);
  const [language, setLanguage] = useState('');
  const [model, setModel] = useState('large-v3');
  const [wordTimestamps, setWordTimestamps] = useState(false);
  const [diarize, setDiarize] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;

    setProcessing(true);
    try {
      const response = await sttApi.transcribe(file, {
        language: language || undefined,
        model,
        word_timestamps: wordTimestamps,
        diarize,
      });
      setResult(response.data);
      toast.success('Transcription completed');
    } catch (error) {
      console.error('Transcription failed:', error);
      toast.error('Transcription failed');
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text);
      toast.success('Text copied to clipboard');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Upload Audio or Video
          </CardTitle>
          <CardDescription>
            Transcribe speech from audio/video files with speaker detection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="space-y-2">
                <Mic className="h-12 w-12 mx-auto text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Click to upload audio or video
                </p>
                <p className="text-sm text-muted-foreground">
                  MP3, WAV, M4A, MP4, WEBM up to 100MB
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <Input
                  placeholder="Auto-detect"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiny">Tiny (fastest)</SelectItem>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large-v3">Large v3 (best)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="word-timestamps">Word Timestamps</Label>
              <Switch
                id="word-timestamps"
                checked={wordTimestamps}
                onCheckedChange={setWordTimestamps}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="diarize">Speaker Diarization</Label>
              <Switch
                id="diarize"
                checked={diarize}
                onCheckedChange={setDiarize}
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleTranscribe}
            disabled={!file || processing}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Transcribing...
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Transcribe
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transcription</span>
            {result && (
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Languages className="h-3 w-3" />
                  {result.language} ({(result.language_probability * 100).toFixed(0)}%)
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(result.duration_seconds)}
                </Badge>
                <Badge variant="secondary">
                  {result.processing_time_ms}ms
                </Badge>
                {result.speakers && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {result.speakers.length} speakers
                  </Badge>
                )}
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {result.segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="p-3 rounded-lg bg-muted/50 space-y-1"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </span>
                      {segment.speaker && (
                        <Badge variant="outline" className="text-xs">
                          {segment.speaker}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">{segment.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              Upload audio to transcribe
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TtsTab() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('en_US-lessac-medium');
  const [speed, setSpeed] = useState(1.0);
  const [format, setFormat] = useState<'wav' | 'mp3'>('mp3');
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleGenerate = async () => {
    if (!text.trim()) return;

    setGenerating(true);
    try {
      const response = await ttsApi.synthesize(text, {
        voice,
        speed,
        format,
      });

      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      setAudioUrl(url);
      toast.success('Audio generated successfully');
    } catch (error) {
      console.error('TTS failed:', error);
      toast.error('Failed to generate audio');
    } finally {
      setGenerating(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `speech.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Text Input
          </CardTitle>
          <CardDescription>
            Convert text to natural-sounding speech with multiple voices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Text to synthesize</Label>
            <Textarea
              placeholder="Enter text to convert to speech..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground text-right">
              {text.length}/10,000 characters
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_US-lessac-medium">Lessac (US English)</SelectItem>
                  <SelectItem value="en_US-amy-medium">Amy (US English)</SelectItem>
                  <SelectItem value="en_GB-alan-medium">Alan (British)</SelectItem>
                  <SelectItem value="fr_FR-upmc-medium">French</SelectItem>
                  <SelectItem value="de_DE-thorsten-medium">German</SelectItem>
                  <SelectItem value="es_ES-carlfm-medium">Spanish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as 'wav' | 'mp3')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3</SelectItem>
                  <SelectItem value="wav">WAV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Speed: {speed.toFixed(1)}x</Label>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={!text.trim() || generating}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Volume2 className="mr-2 h-4 w-4" />
                Generate Speech
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audio Output</CardTitle>
        </CardHeader>
        <CardContent>
          {audioUrl ? (
            <div className="space-y-6">
              <audio
                ref={audioRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />

              <div className="flex items-center justify-center gap-4 py-12">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-20 w-20 rounded-full"
                  onClick={togglePlay}
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="h-8 w-8 ml-1" />
                  )}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDownload}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download {format.toUpperCase()}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Enter text and generate speech
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
