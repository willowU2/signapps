"use client"

import { SpinnerInfinity } from 'spinners-react';
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
    Sparkles, Hash, Phone, Video, Search, ChevronDown, Bot, X, CheckCircle,
    Info, Pin, Download, Bell, BellOff, Lock, Globe
} from 'lucide-react';
import { useChat } from "@/hooks/use-chat"
import { cn } from "@/lib/utils"
import { MessageItem, ChatMessage } from "./message-item"
import { ChatInput } from "./chat-input"
import { ThreadPane } from "./thread-pane"
import { PinnedMessages } from "./pinned-messages"
import { ChatDropZone } from "./file-attachment"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAiStream } from "@/hooks/use-ai-stream"
import { useAuth } from "@/hooks/use-auth"
import { useChatNotifications } from "@/hooks/use-chat-notifications"
import { chatApi, ChatAttachment as Attachment } from "@/lib/api/chat"
import { FEATURES } from "@/lib/features"
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip"

interface ChatWindowProps {
    channelId: string
    channelName?: string
    isDm?: boolean | null
    isPrivate?: boolean
}

export function ChatWindow({ channelId, channelName, isDm, isPrivate }: ChatWindowProps) {
    const displayName = channelName || channelId
    const scrollRef = useRef<HTMLDivElement>(null)

    const { user: authUser, isAuthenticated } = useAuth()

    const user = useMemo(() => {
        if (authUser && isAuthenticated) {
            return { id: authUser.id, name: authUser.display_name || authUser.username }
        }
        return { id: `guest-${Date.now()}`, name: "Invité" }
    }, [authUser, isAuthenticated])

    const { messages, sendMessage, addReaction, pinMessage, unpinMessage, markRead, isConnecté, unreadCount }
        = useChat(channelId, user.id, user.name)

    const [activeThreadMsgId, setActiveThreadMsgId] = useState<string | null>(null)
    const [showPinned, setShowPinned] = useState(false)
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)
    const [isShowingAiSummary, setIsShowingAiSummary] = useState(true)

    // IDEA-138: search state
    const [searchOpen, setSearchOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<ChatMessage[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // AI state
    const { stream, stop, isStreaming: isAiStreaming } = useAiStream()
    const [aiCard, setAiCard] = useState<{
        title: string; content: string;
        type: 'summary' | 'task' | 'meet' | 'ask'; status: 'generating' | 'done' | 'error'
    } | null>(null)

    // IDEA-139: desktop notifications
    const { notify, requestPermission, currentPermission } = useChatNotifications(
        FEATURES.CHAT_NOTIFICATIONS && notificationsEnabled
    )

    // Notify on new messages from others
    const lastMsgIdRef = useRef<string | null>(null)
    useEffect(() => {
        if (messages.length === 0) return
        const last = messages[messages.length - 1]
        if (last.id === lastMsgIdRef.current) return
        lastMsgIdRef.current = last.id
        if (last.senderId !== user.id) {
            notify(last.senderName, last.content, channelName)
        }
    }, [messages, user.id, channelName, notify])

    // Cleanup AI on unmount
    useEffect(() => { return () => stop() }, [stop])

    // Auto scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
            if (el && !activeThreadMsgId) {
                setTimeout(() => { el.scrollTop = el.scrollHeight }, 100)
            }
        }
    }, [messages, activeThreadMsgId])

    // Mark read when window is focused
    useEffect(() => {
        if (unreadCount > 0) markRead()
    }, [unreadCount, markRead])

    // IDEA-138: search handler
    const handleSearch = useCallback(async (q: string) => {
        if (!q.trim()) { setSearchResults([]); return }
        setIsSearching(true)
        try {
            const res = await chatApi.searchMessages(channelId, q)
            setSearchResults((res.data || []).map((m: any) => ({
                id: m.id,
                content: m.content,
                senderId: m.user_id,
                senderName: m.username,
                timestamp: new Date(m.created_at).getTime(),
                reactions: m.reactions,
                isPinned: m.is_pinned,
                attachment: m.attachment,
            })))
        } catch {
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }, [channelId])

    useEffect(() => {
        const t = setTimeout(() => { if (searchOpen) handleSearch(searchQuery) }, 300)
        return () => clearTimeout(t)
    }, [searchQuery, searchOpen, handleSearch])

    const handleSendMessage = (content: string, attachment?: Attachment) => {
        if (content.startsWith("/")) { handleSlashCommand(content); return }
        sendMessage(content, undefined, attachment)
    }

    const handleSendVoice = async (blob: Blob, durationSec: number) => {
        if (!channelId || !FEATURES.CHAT_VOICE) return
        try {
            const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" })
            const res = await chatApi.uploadFile(channelId, file)
            const attachment = { ...res.data, durationSec }
            sendMessage(`Voice message (${durationSec}s)`, undefined, attachment)
        } catch {
            // fallback: send without attachment
            sendMessage(`[Voice message — ${durationSec}s]`)
        }
    }

    const handleSlashCommand = (content: string) => {
        const [cmd, ...args] = content.split(" ")
        const query = args.join(" ")
        switch (cmd.toLowerCase()) {
            case "/summarize": triggerAiSummary("Summarizing recent conversation..."); break
            case "/task": setAiCard({ title: "Task Creation", content: `Created task: "${query || "New Task"}"`, type: "task", status: "done" }); break
            case "/meet": setAiCard({ title: "Video Meeting", content: "Started a new video meeting.", type: "meet", status: "done" }); break
            case "/ask": triggerAiQuery(query); break
            default: sendMessage(content); break
        }
    }

    const triggerAiSummary = (title = "Channel Summary") => {
        setIsShowingAiSummary(false)
        setAiCard({ title, content: "", type: "summary", status: "generating" })
        let local = ""
        stream("Summarize the latest messages in bullet points.", {
            onToken: (t) => { local += t; setAiCard(prev => prev ? { ...prev, content: local } : null) },
            onDone: (f) => setAiCard(prev => prev ? { ...prev, content: f || local, status: "done" } : null),
            onError: () => setAiCard({ title, content: "Impossible de générer le résumé.", type: "summary", status: "done" }),
        })
    }

    const triggerAiQuery = (query: string) => {
        if (!query) return
        setAiCard({ title: "AI Assistant", content: "", type: "ask", status: "generating" })
        let local = ""
        stream(query, {
            onToken: (t) => { local += t; setAiCard(prev => prev ? { ...prev, content: local } : null) },
            onDone: (f) => setAiCard(prev => prev ? { ...prev, content: f || local, status: "done" } : null),
            onError: () => setAiCard({ title: "AI Assistant", content: "AI service unavailable.", type: "ask", status: "error" }),
        })
    }

    const handleSendThreadReply = (content: string) => {
        if (activeThreadMsgId) sendMessage(content, activeThreadMsgId)
    }

    const threadedMessage = messages.find(m => m.id === activeThreadMsgId) || null
    const threadReplies = messages.filter(m => m.parentId === activeThreadMsgId)

    const formattedMessages: ChatMessage[] = messages.filter(m => !m.parentId).map(m => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.senderName,
        timestamp: typeof m.timestamp === 'string' ? new Date(m.timestamp).getTime() : (m.timestamp as number),
        reactions: m.reactions,
        isPinned: m.isPinned,
        attachment: m.attachment,
    }))

    // IDEA-142: export
    const handleExport = (format: 'json' | 'csv') => {
        const url = chatApi.getExportUrl(channelId, format)
        window.open(url, '_blank')
    }

    const pinnedCount = formattedMessages.filter(m => m.isPinned).length

    return (
        <ChatDropZone channelId={channelId} onAttach={(att) => sendMessage(`Shared a file: ${att.filename}`, undefined, att)}>
            <div className="flex h-full w-full bg-background overflow-hidden relative">
                <div className="flex flex-col flex-1 min-w-0 transition-all duration-300">

                    {/* Header */}
                    <div className="h-14 border-b flex items-center justify-between px-6 bg-background/95 backdrop-blur-md z-20 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0">
                                {isPrivate ? <Lock className="h-4 w-4" /> : <Hash className="h-5 w-5" />}
                            </div>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-[15px] leading-tight flex items-center gap-1 cursor-pointer hover:underline">
                                        {displayName}
                                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                    </span>
                                    {/* IDEA-141: private/public badge */}
                                    {FEATURES.CHAT_PRIVATE_CHANNELS && (
                                        <span className={cn(
                                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                                            isPrivate ? "bg-amber-500/10 border-amber-500/30 text-amber-600" : "bg-green-500/10 border-green-500/30 text-green-600"
                                        )}>
                                            {isPrivate ? <><Lock className="h-2.5 w-2.5 inline mr-0.5" />Private</> : <><Globe className="h-2.5 w-2.5 inline mr-0.5" />Public</>}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <span className={cn("w-1.5 h-1.5 rounded-full", isConnecté ? "bg-green-500" : "bg-yellow-500")} />
                                    {isConnecté ? (isDm ? "En ligne" : "Connecté") : "Connecting..."}
                                    {unreadCount > 0 && (
                                        <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">
                                            {unreadCount} new
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 text-muted-foreground">
                            {/* Catch me up */}
                            {isShowingAiSummary && (
                                <Button
                                    variant="outline" size="sm"
                                    className="h-8 gap-1.5 mr-2 rounded-full border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary animate-in fade-in zoom-in"
                                    onClick={() => triggerAiSummary("Catch me up")}
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    <span className="text-xs font-semibold">Catch me up</span>
                                </Button>
                            )}

                            <div className="hidden sm:flex items-center gap-1">
                                <Avatar className="h-6 w-6 border-2 border-background -mr-2 z-30">
                                    <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user1" />
                                </Avatar>
                                <Avatar className="h-6 w-6 border-2 border-background z-10">
                                    <AvatarFallback className="text-[9px] font-bold">+</AvatarFallback>
                                </Avatar>
                            </div>

                            <div className="w-px h-5 bg-border mx-2 hidden sm:block" />

                            <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground hidden sm:flex">
                                            <Phone className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Call</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground hidden sm:flex">
                                            <Video className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Video call</TooltipContent>
                                </Tooltip>

                                {/* IDEA-138: search */}
                                {FEATURES.CHAT_SEARCH && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost" size="icon"
                                                className={cn("h-8 w-8 hover:text-foreground", searchOpen && "text-primary bg-primary/10")}
                                                onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setSearchQuery(""); }}
                                            >
                                                <Search className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Search messages</TooltipContent>
                                    </Tooltip>
                                )}

                                {/* IDEA-132: pinned panel */}
                                {FEATURES.CHAT_PINS && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost" size="icon"
                                                className={cn("h-8 w-8 hover:text-foreground relative", showPinned && "text-primary bg-primary/10")}
                                                onClick={() => setShowPinned(!showPinned)}
                                            >
                                                <Pin className="h-4 w-4" />
                                                {pinnedCount > 0 && (
                                                    <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold">
                                                        {pinnedCount}
                                                    </span>
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Pinned messages</TooltipContent>
                                    </Tooltip>
                                )}

                                {/* IDEA-142: export */}
                                {FEATURES.CHAT_EXPORT && !isDm && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost" size="icon"
                                                className="h-8 w-8 hover:text-foreground"
                                                onClick={() => handleExport('json')}
                                                onContextMenu={(e) => { e.preventDefault(); handleExport('csv') }}
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Export history (left-click: JSON, right-click: CSV)</TooltipContent>
                                    </Tooltip>
                                )}

                                {/* IDEA-139: notifications toggle */}
                                {FEATURES.CHAT_NOTIFICATIONS && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost" size="icon"
                                                className="h-8 w-8 hover:text-foreground"
                                                onClick={async () => {
                                                    if (currentPermission() !== 'granted') await requestPermission()
                                                    setNotificationsEnabled(!notificationsEnabled)
                                                }}
                                            >
                                                {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{notificationsEnabled ? "Mute notifications" : "Enable notifications"}</TooltipContent>
                                    </Tooltip>
                                )}

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground">
                                            <Info className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Channel info</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                    {/* IDEA-138: search bar */}
                    {searchOpen && FEATURES.CHAT_SEARCH && (
                        <div className="px-4 py-2 border-b bg-muted/20 animate-in slide-in-from-top-2 fade-in duration-200">
                            <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                <Input
                                    autoFocus
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Rechercher..."
                                    className="border-0 bg-transparent focus-visible:ring-0 h-8 text-sm p-0"
                                />
                                {isSearching && <SpinnerInfinity size={18} color="currentColor" secondaryColor="rgba(128,128,128,0.2)" speed={120} className="text-primary shrink-0" />}
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>

                            {searchQuery && searchResults.length > 0 && (
                                <div className="mt-2 max-h-64 overflow-y-auto space-y-1 border-t pt-2">
                                    {searchResults.map(msg => (
                                        <div key={msg.id} className="text-xs px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                                            <span className="font-semibold text-foreground mr-2">{msg.senderName}</span>
                                            <span className="text-muted-foreground">{msg.content.slice(0, 120)}{msg.content.length > 120 ? "..." : ""}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {searchQuery && !isSearching && searchResults.length === 0 && (
                                <p className="text-xs text-muted-foreground mt-2 px-2">No results for "{searchQuery}"</p>
                            )}
                        </div>
                    )}

                    {/* Messages List Area */}
                    <ScrollArea className="flex-1 min-h-0 px-4 relative" ref={scrollRef}>
                        <div className="flex flex-col min-h-full justify-end py-4">
                            {formattedMessages.length === 0 && isConnecté && (
                                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                                        <Hash className="h-8 w-8" />
                                    </div>
                                    <h2 className="text-xl font-bold mb-2">Welcome to #{displayName}</h2>
                                    <p className="text-muted-foreground text-sm max-w-[300px]">
                                        Start the conversation! You can send messages, share files, and react with emojis.
                                    </p>
                                </div>
                            )}

                            {/* AI Card */}
                            {aiCard && (
                                <div className="mx-4 mb-6 mt-2 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className={cn(
                                        "relative rounded-2xl border p-4 shadow-sm backdrop-blur-sm",
                                        aiCard.type === "summary" ? "border-purple-500/20 bg-purple-500/5" :
                                            aiCard.type === "task" ? "border-blue-500/20 bg-blue-500/5" :
                                                aiCard.type === "meet" ? "border-green-500/20 bg-green-500/5" :
                                                    "border-orange-500/20 bg-orange-500/5"
                                    )}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {aiCard.type === "summary" && <Sparkles className="h-4 w-4 text-purple-500" />}
                                                {aiCard.type === "task" && <CheckCircle className="h-4 w-4 text-blue-500" />}
                                                {aiCard.type === "meet" && <Video className="h-4 w-4 text-green-500" />}
                                                {aiCard.type === "ask" && <Bot className="h-4 w-4 text-orange-500" />}
                                                <h4 className="text-sm font-semibold">{aiCard.title}</h4>
                                                {aiCard.status === "generating" && <SpinnerInfinity size={20} color="currentColor" secondaryColor="rgba(128,128,128,0.2)" speed={120} className="text-muted-foreground ml-2" />}
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-muted rounded-full -mt-1 -mr-1"
                                                onClick={() => { if (aiCard.status === "generating") stop(); setAiCard(null); }}>
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <div className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap pl-6">
                                            {aiCard.content || (aiCard.status === "generating" ? "Thinking..." : "")}
                                        </div>
                                        {aiCard.type === "meet" && aiCard.status === "done" && (
                                            <div className="mt-3 pl-6">
                                                <Button size="sm" className="h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                                                    <Video className="h-3.5 w-3.5" /> Join Meeting
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col justify-end w-full">
                                {formattedMessages.map((msg, i) => {
                                    const showAvatar = i === 0 || formattedMessages[i - 1].senderId !== msg.senderId
                                    const showDate = i === 0 || (msg.timestamp - formattedMessages[i - 1].timestamp > 86400000)
                                    return (
                                        <div key={msg.id} className="flex flex-col">
                                            {showDate && (
                                                <div className="flex items-center justify-center my-6 sticky top-2 z-10">
                                                    <div className="px-3 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest bg-background border rounded-full shadow-sm">
                                                        {new Date(msg.timestamp).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                                                    </div>
                                                </div>
                                            )}
                                            <MessageItem
                                                message={msg}
                                                isMe={msg.senderId === user.id}
                                                showAvatar={showAvatar}
                                                onReplyInThread={(id) => setActiveThreadMsgId(id)}
                                                onAddReaction={addReaction}
                                                onPin={pinMessage}
                                                onUnpin={unpinMessage}
                                                canPin={FEATURES.CHAT_PINS}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Main Input */}
                    <div className="p-4 bg-background shrink-0">
                        <ChatInput
                            onSend={handleSendMessage}
                            onSendVoice={FEATURES.CHAT_VOICE ? handleSendVoice : undefined}
                            channelId={channelId}
                            placeholder={`Message ${isDm ? displayName : `#${displayName}`}`}
                            disabled={!isConnecté}
                        />
                    </div>
                </div>

                {/* Thread Drawer — IDEA-133 */}
                {activeThreadMsgId && (
                    <ThreadPane
                        parentMessage={threadedMessage as unknown as ChatMessage || null}
                        replies={threadReplies as unknown as ChatMessage[]}
                        onClose={() => setActiveThreadMsgId(null)}
                        onSendReply={handleSendThreadReply}
                        currentUserId={user.id}
                    />
                )}

                {/* Pinned messages panel — IDEA-132 */}
                {showPinned && FEATURES.CHAT_PINS && (
                    <PinnedMessages
                        channelId={channelId}
                        onClose={() => setShowPinned(false)}
                        onUnpin={(id) => unpinMessage(id)}
                        canManagePins={true}
                    />
                )}
            </div>
        </ChatDropZone>
    )
}
