'use client';

import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, FileText, Copy, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

interface MeetingMinutes {
  summary: string;
  decisions: string[];
  actions: string[];
  topics: string[];
}

function parseTranscript(transcript: string): MeetingMinutes {
  const lines = transcript.split(/[.!?]\s+/).filter(l => l.trim().length > 5);

  const decisions = lines.filter(l => /decid|agreed|approved|validé|décidé/i.test(l)).map(l => l.trim());
  const actions = lines.filter(l => /will|should|must|need|doit|devra|action/i.test(l)).map(l => l.trim());
  const topics = lines.filter(l => l.trim().length > 20 && !decisions.includes(l.trim()) && !actions.includes(l.trim())).slice(0, 5).map(l => l.trim());

  return {
    summary: lines.slice(0, 3).join('. ') + '.',
    decisions: decisions.slice(0, 5),
    actions: actions.slice(0, 7),
    topics,
  };
}

export function MeetingMinutesGenerator() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { toast.error('Speech recognition not supported'); return; }

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'fr-FR';
    let finalTranscript = '';

    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { finalTranscript += e.results[i][0].transcript + ' '; }
        else { interim += e.results[i][0].transcript; }
      }
      setTranscript(finalTranscript + interim);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);

    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
    setMinutes(null);
    toast.success('Recording started — speak your meeting notes');
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  const generateMinutes = () => {
    if (!transcript.trim()) { toast.error('Transcript is empty'); return; }
    const parsed = parseTranscript(transcript);
    setMinutes(parsed);
    toast.success('Meeting minutes generated');
  };

  const copyMinutes = () => {
    if (!minutes) return;
    const md = [
      `# Meeting Minutes`,
      `## Summary\n${minutes.summary}`,
      `## Topics Discussed\n${minutes.topics.map(t => `- ${t}`).join('\n')}`,
      `## Decisions\n${minutes.decisions.map(d => `- ${d}`).join('\n')}`,
      `## Action Items\n${minutes.actions.map(a => `- [ ] ${a}`).join('\n')}`,
    ].join('\n\n');
    navigator.clipboard.writeText(md);
    toast.success('Minutes copied as Markdown');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-primary" />
          Meeting Minutes Auto-Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={recording ? 'destructive' : 'default'}
            onClick={recording ? stopRecording : startRecording}
            className="gap-2"
          >
            {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {recording ? 'Stop Recording' : 'Start Recording'}
          </Button>
          {recording && <Badge className="bg-red-500 animate-pulse">Recording</Badge>}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Transcript (editable)</Label>
          <Textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={5}
            placeholder="Transcript will appear here as you speak, or paste manually..."
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={generateMinutes} disabled={!transcript.trim()} className="gap-2">
            <Wand2 className="h-4 w-4" />Generate Minutes
          </Button>
          {minutes && (
            <Button variant="outline" onClick={copyMinutes} className="gap-2">
              <Copy className="h-4 w-4" />Copy Markdown
            </Button>
          )}
        </div>

        {minutes && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Summary</h3>
              <p className="text-sm">{minutes.summary}</p>
            </section>
            {minutes.decisions.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Decisions</h3>
                <ul className="text-sm space-y-1">
                  {minutes.decisions.map((d, i) => <li key={i} className="flex gap-1.5"><span className="text-green-500">✓</span>{d}</li>)}
                </ul>
              </section>
            )}
            {minutes.actions.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Action Items</h3>
                <ul className="text-sm space-y-1">
                  {minutes.actions.map((a, i) => <li key={i} className="flex gap-1.5"><span className="text-blue-500">→</span>{a}</li>)}
                </ul>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
