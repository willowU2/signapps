"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { useAiStream } from "@/hooks/use-ai-stream";
import { useAiRouting } from "@/hooks/use-ai-routing";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export function AiChatWidget() {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Hello! I am your AI assistant for this document. How can I help you today?' }
    ]);
    const [input, setInput] = useState("");
    const [currentStream, setCurrentStream] = useState("");
    const { stream: triggerStream, isStreaming } = useAiStream();
    const routes = useAiRouting((state) => state.routes);
    const config = routes.docs?.providerId && routes.docs?.modelId
        ? routes.docs
        : routes.default?.providerId && routes.default?.modelId
            ? routes.default
            : { providerId: 'ollama', modelId: 'llama3.2:3b' };
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentStream]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isStreaming) return;

        const userMessage = input;
        setInput("");
        setCurrentStream("");
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);

        setTimeout(async () => {
            const systemPrompt = "You are a helpful AI assistant integrated into a document editor. Be concise and professional.";
            let completeResponse = "";

            await triggerStream(userMessage, {
                onToken: (token) => {
                    setCurrentStream(prev => prev + token);
                },
                onDone: (full) => {
                    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: full }]);
                    setCurrentStream("");
                },
                onError: (err) => {
                    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `Error: ${err}` }]);
                    setCurrentStream("");
                }
            }, {
                provider: config.providerId || undefined,
                model: config.modelId || undefined,
                systemPrompt
            });
        }, 100);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-black/20 animate-fade-in-up">
            <div className="p-3 border-b border-gray-200/50 dark:border-gray-800/50 bg-background/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-indigo-500" />
                    Document Assistant
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Powered by {config.modelId || 'AI'}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 max-w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                <Bot className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        )}
                        <div className={`p-3 rounded-2xl text-sm leading-relaxed overflow-hidden break-words ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-background dark:bg-gray-800 border border-gray-100 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 shadow-sm rounded-tl-sm'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}

                {/* Streaming Placeholder Message */}
                {isStreaming && (
                    <div className="flex gap-3 max-w-full justify-start animate-fade-in">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 mt-0.5">
                            <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                        </div>
                        <div className="p-3 rounded-2xl text-sm leading-relaxed bg-background dark:bg-gray-800 border border-indigo-100 dark:border-indigo-900/50 text-gray-800 dark:text-gray-200 shadow-sm rounded-tl-sm border-l-2 border-l-indigo-500">
                            {currentStream || "Thinking..."}
                            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-indigo-500 animate-pulse rounded-full"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-background/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-800/50 shrink-0">
                <form onSubmit={handleSend} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about your document..."
                        disabled={isStreaming}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700/50 rounded-full py-2.5 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-inner disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isStreaming}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-full transition-colors flex items-center justify-center shadow-sm"
                    >
                        <Send className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
