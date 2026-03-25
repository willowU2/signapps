'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MessageCircle,
  Send,
  X,
  Loader2,
  Minimize2,
  Maximize2,
  BookOpen,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiApi, ChatResponse } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { document_id: string; filename: string; score: number; excerpt: string }[];
}

interface RagChatbotProps {
  /** Collections to search within (RAG context) */
  collections?: string[];
  /** Placeholder text for the input */
  placeholder?: string;
  /** Title shown in the header */
  title?: string;
}

export function RagChatbot({
  collections,
  placeholder = 'Ask about your documents...',
  title = 'AI Document Assistant',
}: RagChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const renderMarkdown = (text: string) => {
    // Basic markdown rendering: bold, italic, code, links, lists
    let html = text
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-muted p-2 rounded text-xs my-2 overflow-x-auto"><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary underline">$1</a>')
      // Unordered lists
      .replace(/^[*-] (.+)$/gm, '<li class="ml-4">$1</li>')
      // Ordered lists
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-2">')
      .replace(/\n/g, '<br/>');

    return `<p class="mb-2">${html}</p>`;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await aiApi.chat(currentInput, {
        collections,
        conversationId,
        includesSources: true,
      });

      const data: ChatResponse = response.data;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Track conversation for follow-up context
      if (!conversationId) {
        setConversationId(`rag_${Date.now()}`);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const panelWidth = isExpanded ? 'w-[600px]' : 'w-96';
  const panelHeight = isExpanded ? 'h-[80vh]' : 'h-[500px]';

  return (
    <>
      {/* Floating Chat Bubble */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-110"
            aria-label="Open RAG Chatbot"
          >
            <BookOpen className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 bg-background border border-input rounded-lg shadow-xl flex flex-col overflow-hidden transition-all duration-200',
            panelWidth,
            panelHeight
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-primary text-primary-foreground px-4 py-3 border-b border-input shrink-0">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <h3 className="font-semibold text-sm">{title}</h3>
              {collections && collections.length > 0 && (
                <span className="text-xs bg-primary-foreground/20 px-2 py-0.5 rounded-full">
                  {collections.length} collection{collections.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsExpanded(!isExpanded)}
                className="hover:bg-primary/80 text-primary-foreground"
                aria-label={isExpanded ? 'Minimize' : 'Expand'}
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsOpen(false)}
                className="hover:bg-primary/80 text-primary-foreground"
                aria-label="Close chatbot"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <div className="text-center">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="mb-1">Ask questions about your documents</p>
                  <p className="text-xs opacity-75">
                    Answers are generated using RAG from your knowledge base
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div key={message.id} className="space-y-1">
                    <div
                      className={cn(
                        'flex gap-2',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] px-3 py-2 rounded-lg text-sm',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-accent text-accent-foreground rounded-bl-none'
                        )}
                      >
                        {message.role === 'assistant' ? (
                          <div
                            className="prose prose-sm max-w-none dark:prose-invert [&_p]:mb-1 [&_li]:text-sm"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdown(message.content),
                            }}
                          />
                        ) : (
                          message.content
                        )}
                      </div>
                    </div>

                    {/* Sources */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-1">
                        {message.sources.map((source, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                            title={`Relevance: ${Math.round(source.score * 100)}%`}
                          >
                            <FileText className="h-3 w-3" />
                            {source.filename}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-2 justify-start">
                    <div className="bg-accent text-accent-foreground px-3 py-2 rounded-lg rounded-bl-none">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-accent-foreground animate-bounce" />
                        <div className="h-2 w-2 rounded-full bg-accent-foreground animate-bounce [animation-delay:100ms]" />
                        <div className="h-2 w-2 rounded-full bg-accent-foreground animate-bounce [animation-delay:200ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-input p-3 bg-muted/30 shrink-0">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="text-sm"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="icon-sm"
                className="shrink-0"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground text-center mt-1">
              RAG-powered by SignApps AI
            </div>
          </div>
        </div>
      )}
    </>
  );
}
