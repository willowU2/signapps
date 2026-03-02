"use client";

import { useRef, useEffect, useState } from "react";
import { useAiStream } from "@/hooks/use-ai-stream";
import { useAiStore } from "@/stores/ai-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Square, Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ChatWidget() {
  const {
    messages,
    isStreaming: storeIsStreaming,
    streamingMessageId,
    addMessage,
    appendToMessage,
    setMessageSources,
    setStreaming,
    clearMessages,
  } = useAiStore();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { stream, stop, isStreaming: hookIsStreaming } = useAiStream();
  const isStreaming = storeIsStreaming || hookIsStreaming;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessageId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMsg = input.trim();
    setInput("");

    addMessage("user", userMsg);
    const assistantMsgId = addMessage("assistant", "");
    setStreaming(true, assistantMsgId);

    await stream(userMsg, {
      onToken: (token) => {
        appendToMessage(assistantMsgId, token);
      },
      onSources: (sources) => {
        setMessageSources(assistantMsgId, sources);
      },
      onError: (err) => {
        appendToMessage(assistantMsgId, `Erreur: ${err}`);
      },
      onDone: () => {
        setStreaming(false, null);
      },
    });

    setStreaming(false, null);
  };

  const handleStop = () => {
    stop();
    setStreaming(false, null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <span className="text-xs text-muted-foreground">
          {messages.length - 1} message{messages.length > 2 ? "s" : ""}
        </span>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={clearMessages}
                disabled={isStreaming || messages.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Effacer la conversation</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="flex flex-col gap-4 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 text-sm",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col gap-1 max-w-[80%]">
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 whitespace-pre-wrap break-words",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {msg.content ||
                    (isStreaming && msg.id === streamingMessageId
                      ? "..."
                      : "")}
                </div>
                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {msg.sources.slice(0, 3).map((source, idx) => (
                      <TooltipProvider key={idx} delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 cursor-help">
                              <FileText className="h-3 w-3" />
                              <span className="truncate max-w-[100px]">
                                {source.filename}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="text-xs">{source.excerpt}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 pt-2 mt-auto border-t border-border/50">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 bg-muted/50 rounded-lg p-1 border border-border/50 focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-colors"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question..."
            className="border-0 focus-visible:ring-0 bg-transparent text-sm"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              size="icon"
              variant="ghost"
              type="button"
              onClick={handleStop}
              className="text-destructive h-8 w-8 shrink-0 hover:bg-destructive/10"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              type="submit"
              disabled={!input.trim()}
              className="h-8 w-8 shrink-0 text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
