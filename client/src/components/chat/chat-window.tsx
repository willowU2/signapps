"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Paperclip, Smile, MoreHorizontal, Loader2 } from "lucide-react"
import { useChat } from "@/hooks/use-chat"
import { cn } from "@/lib/utils"

interface ChatWindowProps {
    channelId: string
}

export function ChatWindow({ channelId }: ChatWindowProps) {
    const [inputValue, setInputValue] = useState("")
    const scrollRef = useRef<HTMLDivElement>(null)

    // Mock user (persistent for the component lifecycle)
    const [user] = useState(() => ({
        id: "user-" + Math.floor(Math.random() * 1000),
        name: "User " + Math.floor(Math.random() * 1000)
    }))

    const { messages, sendMessage, isConnected } = useChat(channelId, user.id, user.name)

    // Auto scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight
            }
        }
    }, [messages])

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!inputValue.trim()) return

        sendMessage(inputValue)
        setInputValue("")
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-between px-6 bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full transition-colors", isConnected ? "bg-green-500" : "bg-yellow-500")} />
                    <span className="font-semibold text-lg">#{channelId}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline-block">
                        {isConnected ? "Connected" : "Connecting..."}
                    </span>
                </div>
                <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-6 px-2">
                    {messages.map((msg, i) => {
                        const isMe = msg.senderId === user.id
                        const showAvatar = i === 0 || messages[i - 1].senderId !== msg.senderId
                        const date = new Date(msg.timestamp)

                        return (
                            <div key={msg.id} className={`flex gap-3 ${!showAvatar ? "mt-1" : "mt-4"}`}>
                                {showAvatar ? (
                                    <Avatar className="h-8 w-8 mt-1">
                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`} />
                                        <AvatarFallback>{msg.senderName[0]}</AvatarFallback>
                                    </Avatar>
                                ) : (
                                    <div className="w-8" />
                                )}

                                <div className="flex flex-col flex-1">
                                    {showAvatar && (
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-sm font-semibold">{msg.senderName}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    )}
                                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                        {msg.content}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                    {messages.length === 0 && isConnected && (
                        <div className="text-center text-muted-foreground py-10">
                            No messages yet. Be the first to say hello!
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-background">
                <form
                    onSubmit={handleSendMessage}
                    className="relative flex items-center gap-2 rounded-xl border bg-muted/30 p-2 focus-within:ring-1 focus-within:ring-ring focus-within:bg-background transition-all"
                >
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                        <Paperclip className="h-5 w-5" />
                    </Button>

                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={`Message #${channelId}`}
                        className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-2 h-10"
                        disabled={!isConnected}
                    />

                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                        <Smile className="h-5 w-5" />
                    </Button>

                    <Button
                        type="submit"
                        size="icon"
                        className={cn(
                            "h-9 w-9 transition-all",
                            inputValue.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                        disabled={!inputValue.trim() || !isConnected}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
                <div className="px-2 mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span><strong>Return</strong> to send</span>
                    <span><strong>Shift + Return</strong> to add a new line</span>
                </div>
            </div>
        </div>
    )
}
