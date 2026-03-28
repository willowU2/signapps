"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pin, X, PinOff } from "lucide-react";
import { chatApi, ChatMessage } from "@/lib/api/chat";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "./chat-markdown";

interface PinnedMessagesProps {
    channelId: string;
    onClose: () => void;
    onUnpin?: (messageId: string) => void;
    canManagePins?: boolean;
}

/**
 * IDEA-132: Pinned messages per channel — displays a panel of pinned messages
 * with optional unpin capability for admins.
 */
export function PinnedMessages({ channelId, onClose, onUnpin, canManagePins }: PinnedMessagesProps) {
    const [pinned, setPinned] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        chatApi.getPinnedMessages(channelId)
            .then(res => setPinned(res.data || []))
            .catch(() => setPinned([]))
            .finally(() => setLoading(false));
    }, [channelId]);

    const handleUnpin = async (msgId: string) => {
        try {
            await chatApi.unpinMessage(channelId, msgId);
            setPinned(prev => prev.filter(m => m.id !== msgId));
            onUnpin?.(msgId);
        } catch {
            // ignore
        }
    };

    return (
        <div className="w-72 lg:w-80 border-l flex flex-col bg-background h-full shadow-lg animate-in slide-in-from-right-10 duration-300">
            <div className="h-14 border-b flex items-center justify-between px-4 bg-muted/20">
                <div className="flex items-center gap-2">
                    <Pin className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Pinned Messages</span>
                    {pinned.length > 0 && (
                        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{pinned.length}</span>
                    )}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                        Loading...
                    </div>
                ) : pinned.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Pin className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No pinned messages</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Hover a message and click the pin icon to pin it here.
                        </p>
                    </div>
                ) : (
                    <div className="p-3 space-y-2">
                        {pinned.map(msg => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "group relative rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-1.5 mb-1">
                                            <span className="text-xs font-semibold truncate">{msg.username}</span>
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                {new Date(msg.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="text-sm text-foreground/80 line-clamp-3 break-words">
                                            <ChatMarkdown content={msg.content} />
                                        </div>
                                    </div>
                                    {canManagePins && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            onClick={() => handleUnpin(msg.id)}
                                        >
                                            <PinOff className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
