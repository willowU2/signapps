'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { aiApi } from '@/lib/api/ai';

interface SmartComposeProps {
  value: string;
  onChange: (value: string) => void;
  context?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function SmartCompose({ value, onChange, context, placeholder, rows = 6, className = '' }: SmartComposeProps) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestion = useCallback(async (text: string) => {
    if (text.trim().length < 20) {
      setSuggestion('');
      return;
    }

    setLoading(true);
    try {
      const res = await aiApi.chat(
        `Continue this email draft naturally with 1-2 short sentences. Only output the continuation, nothing else.\n\n${text}`,
        { systemPrompt: 'You complete email drafts professionally and concisely. Output ONLY the continuation text.', language: 'fr' }
      );
      const answer = res.data?.answer || '';
      setSuggestion(answer.trim());
    } catch {
      setSuggestion('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.endsWith(' ') || value.endsWith('.') || value.endsWith('\n')) {
        fetchSuggestion(value);
      }
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestion]);

  const acceptSuggestion = () => {
    if (suggestion) {
      onChange(value + (value.endsWith(' ') ? '' : ' ') + suggestion);
      setSuggestion('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault();
      acceptSuggestion();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setSuggestion(''); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none focus:ring-2 focus:ring-primary/20 outline-none ${className}`}
      />
      {suggestion && (
        <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2 text-xs text-muted-foreground bg-background/90 backdrop-blur-sm rounded-md px-2 py-1.5 border">
          <Sparkles className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate italic">{suggestion}</span>
          <kbd className="ml-auto shrink-0 text-[10px] px-1 py-0.5 rounded border bg-muted font-mono">Tab</kbd>
        </div>
      )}
      {loading && (
        <div className="absolute top-2 right-2">
          <Sparkles className="h-3.5 w-3.5 text-primary/40 animate-pulse" />
        </div>
      )}
    </div>
  );
}
