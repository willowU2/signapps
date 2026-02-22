"use client";

import { useState, useRef, useEffect } from "react";
import { useAiStream } from "@/hooks/use-ai-stream";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export function ChatWidget() {
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hi! How can I help you with your work today?" }
    ]);
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    const { stream, stop, isStreaming } = useAiStream();

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isStreaming) return;

        const userMsg = input.trim();
        setInput("");

        // Add user message
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);

        // Add empty assistant message placeholder
        setMessages(prev => [...prev, { role: "assistant", content: "" }]);

        await stream(userMsg, {
            onToken: (token) => {
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMsgIndex = newMessages.length - 1;
                    newMessages[lastMsgIndex] = {
                        ...newMessages[lastMsgIndex],
                        content: newMessages[lastMsgIndex].content + token
                    };
                    return newMessages;
                });
            },
            onError: (err) => {
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = `Error: ${err}`;
                    return newMessages;
                });
            }
        });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] pb-4">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="flex flex-col gap-4">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                "flex gap-3 text-sm",
                                msg.role === "user" ? "flex-row-reverse" : "flex-row"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                                {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                            </div>
                            <div className={cn(
                                "rounded-lg px-3 py-2 max-w-[80%] whitespace-pre-wrap",
                                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                                {msg.content || (isStreaming && i === messages.length - 1 ? "Thinking..." : "")}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            <div className="p-4 pt-0 mt-auto">
                <form
                    onSubmit={handleSubmit}
                    className="flex items-center gap-2 bg-muted/50 rounded-lg p-1 border focus-within:ring-1 focus-within:ring-ring"
                >
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask AI..."
                        className="border-0 focus-visible:ring-0 bg-transparent"
                        disabled={isStreaming}
                    />
                    {isStreaming ? (
                        <Button size="icon" variant="ghost" type="button" onClick={stop} className="text-destructive h-8 w-8 shrink-0">
                            <Square className="h-4 w-4 fill-current" />
                        </Button>
                    ) : (
                        <Button size="icon" variant="ghost" type="submit" disabled={!input.trim()} className="h-8 w-8 shrink-0 text-primary">
                            <Send className="h-4 w-4" />
                        </Button>
                    )}
                </form>
            </div>
        </div>
    );
}
