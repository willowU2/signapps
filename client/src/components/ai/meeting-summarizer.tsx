'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileAudio, Copy, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api';

interface SummaryResult {
  decisions: string[];
  actions: string[];
  openPoints: string[];
}

export function MeetingSummarizer() {
  const [transcription, setTranscription] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAudioUpload = async (file: File) => {
    setAudioFile(file);
    toast.info(`Audio file: ${file.name}`);
  };

  const handleGenerateSummary = async () => {
    if (!transcription.trim() && !audioFile) {
      toast.error('Please provide transcription or upload audio file');
      return;
    }

    setIsLoading(true);
    try {
      const prompt = `Analyze the following meeting transcription and provide a structured summary with:
1. Key decisions made
2. Action items with owners if mentioned
3. Open questions or points to follow up on

Transcription:
${transcription || `[Audio file: ${audioFile?.name}]`}

Provide the response in JSON format with keys: decisions (array), actions (array), openPoints (array)`;

      const response = await aiApi.chat(prompt);

      try {
        const jsonMatch = response.data.answer.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
          decisions: ['Unable to parse decisions'],
          actions: ['Unable to parse actions'],
          openPoints: ['Unable to parse open points']
        };
        setResult(parsed);
        toast.success('Summary generated successfully');
      } catch {
        toast.error('Failed to parse summary format');
      }
    } catch (error) {
      toast.error('Failed to generate summary');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `Meeting Summary\n\nDecisions:\n${result.decisions.join('\n')}\n\nActions:\n${result.actions.join('\n')}\n\nOpen Points:\n${result.openPoints.join('\n')}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copié dans le presse-papiers');
  };

  const handleExport = async () => {
    if (!result) return;
    const content = `Meeting Summary\n\n=== Decisions ===\n${result.decisions.join('\n')}\n\n=== Actions ===\n${result.actions.join('\n')}\n\n=== Open Points ===\n${result.openPoints.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meeting-summary.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Summary exported');
  };

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Meeting Summarizer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Audio File</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => e.target.files && handleAudioUpload(e.target.files[0])}
              className="block w-full text-sm text-slate-500"
            />
            {audioFile && <p className="text-xs text-green-600 mt-1">✓ {audioFile.name}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Meeting Transcription</label>
            <Textarea
              placeholder="Paste the meeting transcription here or upload an audio file..."
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              className="min-h-[150px]"
            />
          </div>

          <Button
            onClick={handleGenerateSummary}
            disabled={isLoading || (!transcription.trim() && !audioFile)}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Resume...
              </>
            ) : (
              'Générer Résumé'
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Summary Results
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-sm mb-3">Decisions</h3>
              <ul className="space-y-2">
                {result.decisions.map((decision, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    {decision}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3">Actions</h3>
              <ul className="space-y-2">
                {result.actions.map((action, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2">
                    <span className="text-amber-600 font-bold">→</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3">Open Points</h3>
              <ul className="space-y-2">
                {result.openPoints.map((point, i) => (
                  <li key={i} className="text-sm text-slate-700 flex gap-2">
                    <span className="text-orange-600 font-bold">?</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
