"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles, Hash, Phone, Video, Search, ChevronDown, BellOff, Info } from "lucide-react"
import { useChat } from "@/hooks/use-chat"
import { cn } from "@/lib/utils"
import { MessageItem, ChatMessage } from "./message-item"
import { ChatInput } from "./chat-input"
import { ThreadPane } from "./thread-pane"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ChatWindowProps {
    channelId: string
}

export function ChatWindow({ channelId }: ChatWindowProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    // Mock user (persistent for the component lifecycle)
    const [user] = useState(() => ({
        id: "user-" + Math.floor(Math.random() * 1000),
        name: "User " + Math.floor(Math.random() * 1000)
    }))

    const { messages, sendMessage, isConnected } = useChat(channelId, user.id, user.name)
    const [activeThreadMsgId, setActiveThreadMsgId] = useState<string | null>(null)
    const [isShowingAiSummary, setIsShowingAiSummary] = useState(true)

    // Auto scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (scrollElement && !activeThreadMsgId) {
                // Don't auto scroll wildly if they are reading a thread
                setTimeout(() => {
                    scrollElement.scrollTop = scrollElement.scrollHeight
                }, 100);
            }
        }
    }, [messages, activeThreadMsgId])

    const handleSendMessage = (content: string) => {
        sendMessage(content)
    }

    const handleSendThreadReply = (content: string) => {
        // In a real app we'd attach a parentId to sendMessage
        // For iteration 1, we just mock sending it to the main channel prefixed
        sendMessage(`[Thread Reply] ${content}`)
    }

    const threadedMessage = messages.find(m => m.id === activeThreadMsgId) || null
    // Mock replies finding: any message after it that has "[Thread Reply]"
    const mockReplies = messages.filter(m => m.timestamp > (threadedMessage?.timestamp || 0) && m.content.includes("[Thread Reply]"));

    // Map useChat messages to ChatMessage interface
    const formattedMessages: ChatMessage[] = messages.filter(m => !m.content.includes("[Thread Reply]")).map(m => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.senderName,
        timestamp: m.timestamp,
        reactions: Object.keys(m).includes("reactions") ? (m as any).reactions : undefined
    }))

    return (
        <div className="flex h-full w-full bg-background overflow-hidden relative">
            <div className="flex flex-col flex-1 min-w-0 transition-all duration-300">
                {/* Premium Header */}
                <div className="h-14 border-b flex items-center justify-between px-6 bg-background/95 backdrop-blur-md z-20 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                            <Hash className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-[15px] leading-tight flex items-center gap-1 cursor-pointer hover:underline">
                                    {channelId}
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <span className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-green-500" : "bg-yellow-500")} />
                                {isConnected ? "34 members" : "Connecting..."}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 text-muted-foreground">
                        {/* "Catch Me Up" AI Button for Unicorn vibe */}
                        {isShowingAiSummary && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 mr-2 rounded-full border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all animate-in fade-in zoom-in"
                                onClick={() => setIsShowingAiSummary(false)}
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span className="text-xs font-semibold">Catch me up</span>
                            </Button>
                        )}
                        <div className="hidden sm:flex items-center gap-1">
                            <Avatar className="h-6 w-6 border-2 border-background -mr-2 z-30">
                                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user1" />
                            </Avatar>
                            <Avatar className="h-6 w-6 border-2 border-background -mr-2 z-20">
                                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user2" />
                            </Avatar>
                            <Avatar className="h-6 w-6 border-2 border-background z-10">
                                <AvatarFallback className="text-[9px] font-bold">32+</AvatarFallback>
                            </Avatar>
                        </div>

                        <div className="w-px h-5 bg-border mx-2 hidden sm:block" />

                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground hidden sm:flex">
                            <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground hidden sm:flex">
                            <Video className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground">
                            <Search className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground">
                            <Info className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Messages List Area */}
                <ScrollArea className="flex-1 px-4 relative" ref={scrollRef}>
                    <div className="flex flex-col min-h-full justify-end py-4">
                        {formattedMessages.length === 0 && isConnected && (
                            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                                    <Hash className="h-8 w-8" />
                                </div>
                                <h2 className="text-xl font-bold mb-2">Welcome to #{channelId}</h2>
                                <p className="text-muted-foreground text-sm max-w-[300px]">
                                    This is the start of the #{channelId} channel. You can message, share files, and collaborate.
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col justify-end w-full">
                            {formattedMessages.map((msg, i) => {
                                const showAvatar = i === 0 || formattedMessages[i - 1].senderId !== msg.senderId;
                                // Inject a date divider mock logic
                                const showDate = i === 0 || (msg.timestamp - formattedMessages[i - 1].timestamp > 86400000);

                                return (
                                    <div key={msg.id} className="flex flex-col">
                                        {showDate && (
                                            <div className="flex items-center justify-center my-6 sticky top-2 z-10 font-medium">
                                                <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest bg-background border rounded-full shadow-sm">
                                                    Today
                                                </div>
                                            </div>
                                        )}
                                        <MessageItem
                                            message={msg}
                                            isMe={msg.senderId === user.id}
                                            showAvatar={showAvatar}
                                            onReplyInThread={(id) => setActiveThreadMsgId(id)}
                                            onAddReaction={(id, emoji) => {
                                                // mock reaction visual logic
                                                console.log("Reacting to", id, "with", emoji)
                                            }}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </ScrollArea>

                {/* Main Input Component */}
                <div className="p-4 bg-background">
                    <ChatInput
                        onSend={handleSendMessage}
                        placeholder={`Message #${channelId}`}
                        disabled={!isConnected}
                    />
                </div>
            </div>

            {/* Thread Drawer */}
            {activeThreadMsgId && (
                <ThreadPane
                    parentMessage={threadedMessage as unknown as ChatMessage || null}
                    replies={mockReplies as unknown as ChatMessage[]}
                    onClose={() => setActiveThreadMsgId(null)}
                    onSendReply={handleSendThreadReply}
                    currentUserId={user.id}
                />
            )}
        </div>
    )
}
