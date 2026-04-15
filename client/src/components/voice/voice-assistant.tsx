"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_COMMANDS = [
  "Create a new project",
  "Schedule a meeting",
  "Generate report",
  "Search documents",
];

export function VoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I understood your request. Processing...",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleMicClick = () => {
    setIsListening(!isListening);
    if (!isListening) {
      setTimeout(() => {
        setInputValue("Create a new project for the Q2 initiative");
        setIsListening(false);
      }, 2000);
    }
  };

  const handleSuggestedCommand = (command: string) => {
    setInputValue(command);
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all hover:scale-110"
            aria-label="Open Voice Assistant"
          >
            <Mic className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Assistant Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-background border border-input rounded-lg shadow-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary text-primary-foreground px-4 py-3 border-b border-input">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              <h3 className="font-semibold text-sm">Voice Assistant</h3>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setIsOpen(false)}
              className="hover:bg-primary/80 text-primary-foreground"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages or Empty State */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 bg-muted rounded-full">
                  <Mic className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Voice Assistant Ready
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click the mic or type a command
                  </p>
                </div>

                {/* Suggested Commands */}
                <div className="w-full space-y-2 mt-4">
                  <p className="text-xs text-muted-foreground font-medium">
                    Suggested commands:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTED_COMMANDS.map((cmd) => (
                      <Button
                        key={cmd}
                        onClick={() => handleSuggestedCommand(cmd)}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        aria-label={`Use command: ${cmd}`}
                      >
                        {cmd}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2 mb-3",
                      message.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-xs px-3 py-2 rounded-lg text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-none"
                          : "bg-accent text-accent-foreground rounded-bl-none",
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-2 justify-start mb-3">
                    <div className="bg-accent text-accent-foreground px-3 py-2 rounded-lg rounded-bl-none">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-accent-foreground animate-bounce" />
                        <div className="h-2 w-2 rounded-full bg-accent-foreground animate-bounce delay-100" />
                        <div className="h-2 w-2 rounded-full bg-accent-foreground animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-input p-3 bg-muted/30 space-y-2">
            {isListening && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted rounded">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-bounce" />
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-bounce delay-100" />
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-bounce delay-200" />
                </div>
                <span>Listening...</span>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Type or use voice..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isLoading) {
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                className="text-sm"
                aria-label="Message input"
              />
              <Button
                onClick={handleMicClick}
                size="icon-sm"
                variant={isListening ? "destructive" : "outline"}
                className={isListening ? "animate-pulse" : ""}
                aria-label="Toggle voice input"
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="icon-sm"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
