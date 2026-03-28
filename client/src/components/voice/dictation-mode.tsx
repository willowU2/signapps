'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, RotateCcw, Copy, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

export function DictationMode() {
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const accumulatedRef = useRef('');

  const startDictation = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { toast.error('Speech recognition not supported in this browser'); return; }

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'fr-FR';
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let newInterim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          accumulatedRef.current += e.results[i][0].transcript + ' ';
          setText(accumulatedRef.current);
        } else {
          newInterim += e.results[i][0].transcript;
        }
      }
      setInterim(newInterim);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') { toast.error(`Dictation error: ${e.error}`); }
    };

    rec.onend = () => {
      if (active) { rec.start(); }
    };

    recognitionRef.current = rec;
    accumulatedRef.current = text;
    rec.start();
    setActive(true);
  }, [active, text]);

  const stopDictation = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setActive(false);
    setInterim('');
  }, []);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const copy = () => {
    navigator.clipboard.writeText(text);
    toast.success('Text copied');
  };

  const clear = () => {
    setText('');
    accumulatedRef.current = '';
    setInterim('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Edit3 className="h-5 w-5 text-primary" />
            Dictation Mode
            {active && <Badge className="bg-red-500 text-xs animate-pulse">Dictating</Badge>}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={copy} disabled={!text} className="gap-1.5">
              <Copy className="h-3.5 w-3.5" />Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={clear} disabled={!text} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Continuous speech-to-text input — just speak and the text appears in real time.
        </p>

        <div className="relative">
          <Textarea
            value={text + (interim ? interim : '')}
            onChange={e => { setText(e.target.value); accumulatedRef.current = e.target.value; }}
            rows={8}
            className="text-sm resize-none pr-4"
            placeholder="Start dictating or type here..."
          />
          {interim && (
            <div className="absolute bottom-3 left-3 right-3">
              <span className="text-sm text-muted-foreground italic">{interim}</span>
              <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant={active ? 'destructive' : 'default'}
            onClick={active ? stopDictation : startDictation}
            className="gap-2"
          >
            {active ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {active ? 'Stop Dictation' : 'Start Dictating'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {text.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
