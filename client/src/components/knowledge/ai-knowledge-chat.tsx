'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User, Loader2, BookOpen, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '@/lib/api/ai';
import type { ChatResponse } from '@/lib/api/ai';

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatResponse['sources'];
  loading?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

interface AiKnowledgeChatProps {
  /** AI collection names to use for RAG. Defaults to internal-docs. */
  collections?: string[];
  /** Compact mode for sidebar embedding */
  compact?: boolean;
}

export function AiKnowledgeChat({ collections = ['internal-docs'], compact = false }: AiKnowledgeChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant de connaissances. Posez-moi des questions sur vos documents internes.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: q };
    const loadingMsg: Message = { id: `loading-${Date.now()}`, role: 'assistant', content: '', loading: true };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiApi.chat(q, {
        collections,
        includesSources: true,
        enableTools: false,
        systemPrompt:
          'Tu es un assistant de base de connaissances interne. Réponds en te basant sur les documents fournis. ' +
          'Si tu ne trouves pas l\'information dans les documents, dis-le clairement. Réponds en français.',
      });

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
      };

      setMessages(prev => prev.filter(m => !m.loading).concat(assistantMsg));
    } catch {
      toast.error('Erreur de l\'assistant IA');
      setMessages(prev => prev.filter(m => !m.loading).concat({
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Désolé, une erreur s\'est produite. Vérifiez que le service IA est disponible.',
      }));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, collections]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`flex flex-col ${compact ? 'h-80' : 'h-full min-h-[400px]'}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center gap-2 p-4 border-b">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Assistant de connaissances</span>
          <Badge variant="secondary" className="text-xs ml-auto">
            {collections.join(', ')}
          </Badge>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        <div className="space-y-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] space-y-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  }`}
                >
                  {msg.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1 w-full">
                    <p className="text-xs text-muted-foreground">Sources :</p>
                    {msg.sources.map((src, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2 py-1">
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{src.filename}</span>
                        <Badge variant="outline" className="text-xs ml-auto shrink-0">
                          {Math.round(src.score * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Posez une question sur vos documents…"
          className="text-sm"
          disabled={loading}
        />
        <Button size="icon" onClick={sendMessage} disabled={!input.trim() || loading} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
