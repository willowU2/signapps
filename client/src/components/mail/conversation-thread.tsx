"use client"

// IDEA-035: Conversation threading — group emails by thread_id, expandable conversation view

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Mail } from "@/lib/data/mail"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface ConversationThread {
    threadId: string
    subject: string
    messages: Mail[]
}

interface ConversationThreadViewProps {
    threads: ConversationThread[]
    selectedId: string | null
    onSelect: (id: string) => void
}

function groupByThread(mails: Mail[]): ConversationThread[] {
    const map = new Map<string, Mail[]>()
    for (const mail of mails) {
        // Group by thread_id if available, else use first word of subject as fallback key
        const key = (mail as any).thread_id || mail.subject.split(" ").slice(0, 3).join(" ").toLowerCase()
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(mail)
    }
    return Array.from(map.entries()).map(([threadId, messages]) => ({
        threadId,
        subject: messages[0].subject,
        messages: messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }))
}

function ThreadRow({ thread, selectedId, onSelect }: {
    thread: ConversationThread
    selectedId: string | null
    onSelect: (id: string) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const latest = thread.messages[0]
    const hasSelected = thread.messages.some((m) => m.id === selectedId)
    const unreadCount = thread.messages.filter((m) => !m.read).length

    if (thread.messages.length === 1) {
        return (
            <button
                className={cn(
                    "group relative flex items-center gap-2 px-1 py-0 h-10 text-left text-sm transition-all w-full border-b border-gray-200/60 dark:border-gray-800/60 cursor-pointer",
                    selectedId === latest.id
                        ? "bg-[#c2e7ff] text-[#001d35] dark:bg-[#004a77] dark:text-[#c2e7ff]"
                        : "bg-background hover:bg-gray-50/80"
                )}
                onClick={() => onSelect(latest.id)}
            >
                <div className="flex-shrink-0 flex items-center gap-2 px-3">
                    <MessageSquare className="h-[18px] w-[18px] text-gray-400" />
                </div>
                <span className={cn("w-48 truncate flex-shrink-0 text-[14px]", !latest.read ? "font-bold" : "font-medium")}>
                    {latest.name}
                </span>
                <span className={cn("truncate flex-1 text-[14px]", !latest.read ? "font-bold" : "font-medium")}>
                    {latest.subject}
                </span>
                <span className="w-24 text-right flex-shrink-0 text-[12px] text-[#5f6368]">
                    {formatDistanceToNow(new Date(latest.date))}
                </span>
            </button>
        )
    }

    return (
        <div className={cn("border-b border-gray-200/60 dark:border-gray-800/60", hasSelected && "bg-blue-50/40 dark:bg-blue-950/20")}>
            {/* Thread header */}
            <button
                className="flex items-center gap-2 px-1 h-10 w-full text-left text-sm hover:bg-gray-50/80 dark:hover:bg-[#202124] transition-all"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex-shrink-0 flex items-center gap-2 px-3">
                    {expanded ? (
                        <ChevronUp className="h-[18px] w-[18px] text-gray-400" />
                    ) : (
                        <ChevronDown className="h-[18px] w-[18px] text-gray-400" />
                    )}
                </div>
                <span className={cn("w-48 truncate flex-shrink-0 text-[14px]", unreadCount > 0 ? "font-bold" : "font-medium")}>
                    {latest.name}
                    {thread.messages.length > 1 && (
                        <span className="ml-1 text-[11px] text-muted-foreground font-normal">({thread.messages.length})</span>
                    )}
                </span>
                <span className={cn("truncate flex-1 text-[14px]", unreadCount > 0 ? "font-bold" : "font-medium")}>
                    {thread.subject}
                </span>
                {unreadCount > 0 && (
                    <Badge className="mr-2 h-5 px-1.5 text-[10px] bg-blue-600 text-white shrink-0">
                        {unreadCount}
                    </Badge>
                )}
                <span className="w-24 text-right flex-shrink-0 text-[12px] text-[#5f6368]">
                    {formatDistanceToNow(new Date(latest.date))}
                </span>
            </button>

            {/* Expanded messages */}
            {expanded && (
                <div className="pl-12 border-t border-gray-100 dark:border-gray-800/60">
                    {thread.messages.map((msg) => (
                        <button
                            key={msg.id}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 w-full text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors",
                                selectedId === msg.id && "bg-[#c2e7ff] dark:bg-[#004a77]"
                            )}
                            onClick={() => onSelect(msg.id)}
                        >
                            <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage src={`https://avatar.vercel.sh/${msg.email}.png`} alt={msg.name} />
                                <AvatarFallback className="text-[10px] bg-blue-600 text-white">{msg.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className={cn("flex-1 truncate text-[13px]", !msg.read ? "font-semibold" : "font-normal")}>
                                {msg.name} — {msg.text.slice(0, 60)}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                                {formatDistanceToNow(new Date(msg.date))}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export function ConversationThreadView({ threads, selectedId, onSelect }: ConversationThreadViewProps) {
    return (
        <div className="flex flex-col">
            {threads.map((thread) => (
                <ThreadRow key={thread.threadId} thread={thread} selectedId={selectedId} onSelect={onSelect} />
            ))}
        </div>
    )
}

export { groupByThread }
export type { ConversationThread }
