'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Mic,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  ExternalLink,
  FileText,
  Loader2,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolCallDisplay, ToolCallInfo } from '@/components/ai/tool-call-display';
import { VoiceInput } from '@/components/ui/voice-input';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { document_id: string; filename: string; score: number; excerpt: string }[];
  toolCalls?: ToolCallInfo[];
  timestamp: number;
}

const suggestions = [
  'Résumer les emails de cette semaine',
  'État des containers',
  'Montrer le pipeline CRM',
];

const AI_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:3005/api/v1';

export function AiChatBar() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [interimText, setInterimText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleTranscription = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setValue((prev) => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text + ' ');
      setInterimText('');
    } else {
      setInterimText(text);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (expanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, expanded]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const question = (text || value).trim();
    if (!question || isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setValue('');
    setExpanded(true);
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const res = await fetch(`${AI_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question,
          language: 'fr',
          include_sources: true,
          enable_tools: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Fallback to non-streaming
        const fallbackRes = await fetch(`${AI_URL}/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            question,
            language: 'fr',
            include_sources: true,
          }),
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: data.answer, sources: data.sources }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'Service IA indisponible. Réessayez plus tard.' }
                : m
            )
          );
        }
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'token') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              );
            } else if (event.type === 'sources') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources: event.sources } : m
                )
              );
            } else if (event.type === 'tool_call') {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const existing = m.toolCalls || [];
                  return {
                    ...m,
                    toolCalls: [...existing, {
                      tool: event.tool,
                      parameters: event.parameters || {},
                      pending: true,
                    }],
                  };
                })
              );
            } else if (event.type === 'tool_result') {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const toolCalls = (m.toolCalls || []).map((tc) =>
                    tc.tool === event.tool && tc.pending
                      ? {
                          ...tc,
                          pending: false,
                          success: event.success,
                          result: event.result,
                          error: event.error,
                        }
                      : tc
                  );
                  return { ...m, toolCalls };
                })
              );
            } else if (event.type === 'done') {
              break;
            } else if (event.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content || `Erreur : ${event.message}` }
                    : m
                )
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || 'Erreur de connexion au service IA.' }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [value, isStreaming]);

  const handleSuggestion = (suggestion: string) => {
    setFocused(false);
    handleSend(suggestion);
  };

  const clearChat = () => {
    setMessages([]);
    setExpanded(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4">
      {/* Suggestions (only when collapsed and focused) */}
      {focused && !expanded && (
        <div className="mb-3 rounded-lg border border-border bg-card p-3 shadow-xl">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Essayez...
          </p>
          <ul className="space-y-1.5">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSuggestion(s);
                  }}
                  className="w-full text-left text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  &ldquo;{s}&rdquo;
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expanded chat panel */}
      {expanded && (
        <div className="mb-3 flex flex-col rounded-xl border border-border bg-card shadow-xl overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ai-purple" />
              <span className="text-xs font-semibold">SignApps AI</span>
              <span className="text-[10px] text-muted-foreground">
                {messages.filter((m) => m.role === 'user').length} message{messages.filter((m) => m.role === 'user').length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => router.push('/ai')}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Ouvrir dans l'assistant complet"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Réduire"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={clearChat}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                title="Effacer la conversation"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Posez une question à l&apos;IA SignApps
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="shrink-0 mt-0.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ai-purple/10">
                      <Bot className="h-3.5 w-3.5 text-ai-purple" />
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-xl px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {/* Tool Calls */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="space-y-1 mb-1.5">
                      {msg.toolCalls.map((tc, i) => (
                        <ToolCallDisplay key={`${tc.tool}-${i}`} toolCall={tc} compact />
                      ))}
                    </div>
                  )}
                  {msg.content || (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Réflexion...</span>
                    </div>
                  )}
                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.sources.slice(0, 3).map((src) => (
                        <span
                          key={src.document_id}
                          className="inline-flex items-center gap-1 rounded bg-background/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          title={src.excerpt}
                        >
                          <FileText className="h-2.5 w-2.5" />
                          {src.filename}
                          <span className="font-bold text-primary">{Math.round(src.score * 100)}%</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="glass-panel flex items-center rounded-full p-2 shadow-2xl ai-glow">
        {/* Bot icon */}
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-primary/30',
            isStreaming ? 'bg-ai-purple animate-pulse' : 'bg-primary'
          )}
        >
          <Bot className="h-5 w-5" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          placeholder="Demander à SignApps AI..."
          value={value + (interimText ? (value && !value.endsWith(' ') ? ' ' : '') + interimText : '')}
          onChange={(e) => {
            setValue(e.target.value);
            setInterimText('');
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(value + (interimText ? (value && !value.endsWith(' ') ? ' ' : '') + interimText : ''));
            }
          }}
          className="flex-1 border-none bg-transparent px-4 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />

        {/* Actions */}
        <div className="flex items-center gap-2 pr-2">
          {/* Expand/collapse toggle */}
          {messages.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              title={expanded ? 'Réduire' : 'Voir la conversation'}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Stop streaming */}
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30"
              title="Arrêter"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <>
              <VoiceInput 
                onTranscription={handleTranscription} 
              />
              <button
                onClick={() => handleSend(value + (interimText ? (value && !value.endsWith(' ') ? ' ' : '') + interimText : ''))}
                disabled={!(value.trim() || interimText.trim())}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                  value.trim()
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'text-slate-500'
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
