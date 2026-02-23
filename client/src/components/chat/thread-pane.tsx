import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem, ChatMessage } from "./message-item";
import { ChatInput } from "./chat-input";

interface ThreadPaneProps {
    parentMessage: ChatMessage | null;
    replies: ChatMessage[];
    onClose: () => void;
    onSendReply: (content: string) => void;
    currentUserId: string;
}

export function ThreadPane({ parentMessage, replies, onClose, onSendReply, currentUserId }: ThreadPaneProps) {
    if (!parentMessage) return null;

    return (
        <div className="w-80 lg:w-96 border-l flex flex-col bg-background h-full shadow-lg transition-all transform animate-in slide-in-from-right-10 duration-300 z-10">
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-between px-4 bg-muted/20 backdrop-blur-md">
                <div className="flex flex-col">
                    <span className="font-semibold text-sm">Thread</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                        #general
                    </span>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Scroll Area */}
            <ScrollArea className="flex-1 p-0">
                <div className="flex flex-col">
                    {/* The Parent Message */}
                    <div className="p-4 pb-2">
                        <MessageItem
                            message={parentMessage}
                            isMe={parentMessage.senderId === currentUserId}
                            showAvatar={true}
                        />
                    </div>

                    <div className="flex items-center px-4 py-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="px-2 text-xs text-muted-foreground font-medium">{replies.length} replies</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Replies */}
                    <div className="p-4 pt-0 space-y-1">
                        {replies.map((reply, i) => {
                            const showAvatar = i === 0 || replies[i - 1].senderId !== reply.senderId;
                            return (
                                <MessageItem
                                    key={reply.id}
                                    message={reply}
                                    isMe={reply.senderId === currentUserId}
                                    showAvatar={showAvatar}
                                />
                            );
                        })}
                        {replies.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-10">
                                No replies yet. Start the conversation!
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 bg-muted/10 border-t">
                <ChatInput
                    onSend={onSendReply}
                    placeholder="Reply in thread..."
                    compact={true}
                />
            </div>
        </div>
    );
}
