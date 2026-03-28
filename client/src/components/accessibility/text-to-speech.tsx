'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Square, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export function TextToSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const v = speechSynthesis.getVoices().filter(v => v.lang.startsWith('fr') || v.lang.startsWith('en'));
      setVoices(v);
      if (v.length > 0 && !selectedVoice) {
        setSelectedVoice(v[0]);
      }
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, [selectedVoice]);

  const readSelection = useCallback(() => {
    const selection = window.getSelection()?.toString().trim();
    if (!selection) {
      toast.warning('Sélectionnez d\'abord du texte à lire');
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selection);
    utterance.rate = rate;
    utterance.pitch = pitch;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [rate, pitch, selectedVoice]);

  const stop = () => {
    speechSynthesis.cancel();
    setSpeaking(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant={speaking ? 'default' : 'outline'}
        size="sm"
        onClick={speaking ? stop : readSelection}
        className="gap-1.5"
        aria-label="Text to speech"
      >
        {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-4 w-4" />}
        {speaking ? 'Stop' : 'Lire la sélection'}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            Options
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 p-3 space-y-4">
          <DropdownMenuLabel>Paramètres TTS</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Vitesse: {rate.toFixed(1)}x</p>
            <Slider
              min={0.5} max={2} step={0.1}
              value={[rate]}
              onValueChange={([v]) => setRate(v)}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Hauteur: {pitch.toFixed(1)}</p>
            <Slider
              min={0.5} max={2} step={0.1}
              value={[pitch]}
              onValueChange={([v]) => setPitch(v)}
            />
          </div>
          {voices.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Voix</p>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {voices.map(v => (
                  <button
                    key={v.voiceURI}
                    className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-accent transition-colors ${
                      selectedVoice?.voiceURI === v.voiceURI ? 'bg-primary text-primary-foreground' : ''
                    }`}
                    onClick={() => setSelectedVoice(v)}
                  >
                    {v.name} ({v.lang})
                  </button>
                ))}
              </div>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
