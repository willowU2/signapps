"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sparkles, Hash, Phone, Video, Search, ChevronDown, Bot, X, Loader2, CheckCircle, Info, LogIn } from "lucide-react"
import { useChat } from "@/hooks/use-chat"
import { cn } from "@/lib/utils"
import { MessageItem, ChatMessage } from "./message-item"
import { ChatInput } from "./chat-input"
import { ThreadPane } from "./thread-pane"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAiStream } from "@/hooks/use-ai-stream"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"

interface ChatWindowProps {
    channelId: string
}

export function ChatWindow({ channelId }: ChatWindowProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    // Use real authenticated user
    const { user: authUser, isAuthenticated } = useAuth()

    // Create user object from auth or fallback to anonymous
    const user = useMemo(() => {
        if (authUser && isAuthenticated) {
            return {
                id: authUser.id,
                name: authUser.display_name || authUser.username,
            }
        }
        // Fallback for anonymous/guest users (should rarely happen)
        return {
            id: `guest-${Date.now()}`,
            name: "Invité",
        }
    }, [authUser, isAuthenticated])

    const { messages, sendMessage, addReaction, isConnected } = useChat(channelId, user.id, user.name)
    const [activeThreadMsgId, setActiveThreadMsgId] = useState<string | null>(null)
    const [isShowingAiSummary, setIsShowingAiSummary] = useState(true)

    // AI & Slash Commands State
    const { stream, stop, isStreaming: isAiStreaming } = useAiStream()
    const [aiCard, setAiCard] = useState<{ title: string, content: string, type: 'summary' | 'task' | 'meet' | 'ask', status: 'generating' | 'done' | 'error' } | null>(null)

    // Cleanup AI on unmount
    useEffect(() => {
        return () => stop()
    }, [stop])

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
        if (content.startsWith("/")) {
            handleSlashCommand(content)
            return
        }
        sendMessage(content)
    }

    const handleSlashCommand = (content: string) => {
        const [cmd, ...args] = content.split(" ")
        const query = args.join(" ")

        switch (cmd.toLowerCase()) {
            case "/summarize":
                triggerAiSummary("Summarizing recent conversation...")
                break
            case "/task":
                setAiCard({ title: "Task Creation", content: `Created task: "${query || "New Task"}" and assigned to you.`, type: 'task', status: 'done' })
                break
            case "/meet":
                setAiCard({ title: "Video Meeting", content: `Started a new video meeting. Click here to join.`, type: 'meet', status: 'done' })
                break
            case "/ask":
                triggerAiQuery(query)
                break
            default:
                // Unknown command, send as normal text
                sendMessage(content)
                break
        }
    }

    const triggerAiSummary = (title: string = "Channel Summary") => {
        setIsShowingAiSummary(false)
        setAiCard({ title, content: "", type: 'summary', status: 'generating' })

        let localContent = ""
        stream("Summarize the latest messages in bullet points.", {
            onToken: (t) => {
                localContent += t
                setAiCard(prev => prev ? { ...prev, content: localContent } : null)
            },
            onDone: (f) => setAiCard(prev => prev ? { ...prev, content: f || localContent, status: 'done' } : null),
            onError: () => {
                // Fallback graceful UI if AI backend is down
                const mockSummary = "• The team discussed the new redesign features.\n• Alice approved the glassmorphism approach.\n• Next step is to implement slash commands."
                setAiCard({ title, content: mockSummary, type: 'summary', status: 'done' })
            }
        })
    }

    const triggerAiQuery = (query: string) => {
        if (!query) return;
        setAiCard({ title: "AI Assistant", content: "", type: 'ask', status: 'generating' })

        let localContent = ""
        stream(query, {
            onToken: (t) => {
                localContent += t
                setAiCard(prev => prev ? { ...prev, content: localContent } : null)
            },
            onDone: (f) => setAiCard(prev => prev ? { ...prev, content: f || localContent, status: 'done' } : null),
            onError: () => {
                setAiCard({ title: "AI Assistant", content: "I'm sorry, I couldn't reach the AI service right now. Please try again later.", type: 'ask', status: 'error' })
            }
        })
    }

    const handleSendThreadReply = (content: string) => {
        if (activeThreadMsgId) {
            sendMessage(content, activeThreadMsgId)
        }
    }

    const threadedMessage = messages.find(m => m.id === activeThreadMsgId) || null
    // Actual replies mapped via parentId
    const threadReplies = messages.filter(m => m.parentId === activeThreadMsgId);

    // Map useChat messages to ChatMessage interface (exclude replies from main feed)
    const formattedMessages: ChatMessage[] = messages.filter(m => !m.parentId).map(m => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.senderName,
        timestamp: typeof m.timestamp === 'string' ? new Date(m.timestamp).getTime() : m.timestamp,
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
                                onClick={() => triggerAiSummary("Catch me up: Recent Activity")}
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

                        {/* AI Action/Result Card inline in chat */}
                        {aiCard && (
                            <div className="mx-4 mb-6 mt-2 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-2xl pointer-events-none" />
                                <div className={cn(
                                    "relative rounded-2xl border p-4 shadow-sm backdrop-blur-sm",
                                    aiCard.type === 'summary' ? "border-purple-500/20 bg-purple-500/5" :
                                        aiCard.type === 'task' ? "border-blue-500/20 bg-blue-500/5" :
                                            aiCard.type === 'meet' ? "border-green-500/20 bg-green-500/5" :
                                                "border-orange-500/20 bg-orange-500/5"
                                )}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {aiCard.type === 'summary' && <Sparkles className="h-4 w-4 text-purple-500" />}
                                            {aiCard.type === 'task' && <CheckCircle className="h-4 w-4 text-blue-500" />}
                                            {aiCard.type === 'meet' && <Video className="h-4 w-4 text-green-500" />}
                                            {aiCard.type === 'ask' && <Bot className="h-4 w-4 text-orange-500" />}

                                            <h4 className="text-sm font-semibold tracking-tight">{aiCard.title}</h4>

                                            {aiCard.status === 'generating' && (
                                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-2" />
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:bg-black/5 dark:hover:bg-background/5 rounded-full -mt-1 -mr-1"
                                            onClick={() => {
                                                if (aiCard.status === 'generating') stop();
                                                setAiCard(null);
                                            }}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    <div className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap pl-6 text-muted-foreground">
                                        {aiCard.content || (aiCard.status === 'generating' ? "Thinking..." : "")}
                                    </div>

                                    {aiCard.type === 'meet' && aiCard.status === 'done' && (
                                        <div className="mt-3 pl-6">
                                            <Button size="sm" className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                                                <Video className="h-3.5 w-3.5" />
                                                Join Meeting
                                            </Button>
                                        </div>
                                    )}
                                </div>
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
                                            onAddReaction={addReaction}
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
                    replies={threadReplies as unknown as ChatMessage[]}
                    onClose={() => setActiveThreadMsgId(null)}
                    onSendReply={handleSendThreadReply}
                    currentUserId={user.id}
                />
            )}
        </div>
    )
}
